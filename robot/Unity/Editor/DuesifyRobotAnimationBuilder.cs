// Duesify robot: builds sliced sprites, AnimationClips and an AnimatorController
// from the sprite sheets in this package.
//
// 1. Copy the whole "robot" folder into your Unity project's Assets folder.
// 2. Run the menu item: Tools > Duesify Robot > Build Animations
// 3. Drop Assets/robot/Generated/Robot.controller onto a GameObject with a SpriteRenderer.
#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

public static class DuesifyRobotAnimationBuilder
{
    [Serializable] class Rect_ { public string name; public int x, y, w, h; }
    [Serializable] class Anim { public string name, texture; public int frames, fps, columns, rows; public bool loop; public Rect_[] rects; }
    [Serializable] class Manifest { public int cellWidth, cellHeight, pixelsPerUnit; public float pivotX, pivotY; public Anim[] animations; }

    [MenuItem("Tools/Duesify Robot/Build Animations")]
    public static void Build()
    {
        string manifestPath = AssetDatabase.FindAssets("robot_animations t:TextAsset")
            .Select(AssetDatabase.GUIDToAssetPath)
            .FirstOrDefault(p => p.EndsWith("robot_animations.json"));
        if (manifestPath == null)
        {
            Debug.LogError("robot_animations.json not found. Copy the robot folder into Assets first.");
            return;
        }

        string root = Path.GetDirectoryName(manifestPath).Replace('\\', '/');
        var manifest = JsonUtility.FromJson<Manifest>(File.ReadAllText(manifestPath));
        string outDir = root + "/Generated";
        if (!AssetDatabase.IsValidFolder(outDir)) AssetDatabase.CreateFolder(root, "Generated");

        var clips = new Dictionary<string, AnimationClip>();
        foreach (var anim in manifest.animations)
        {
            string texPath = root + "/" + anim.texture;
            SliceTexture(texPath, anim, manifest);
            clips[anim.name] = CreateClip(texPath, anim, outDir);
        }

        CreateController(clips, outDir);
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        Debug.Log("Duesify robot: built " + clips.Count + " clips and Robot.controller in " + outDir);
    }

    static void SliceTexture(string path, Anim anim, Manifest m)
    {
        var importer = (TextureImporter)AssetImporter.GetAtPath(path);
        importer.textureType = TextureImporterType.Sprite;
        importer.spriteImportMode = SpriteImportMode.Multiple;
        importer.spritePixelsPerUnit = m.pixelsPerUnit;
        importer.mipmapEnabled = false;
        importer.alphaIsTransparency = true;
        importer.filterMode = FilterMode.Bilinear;
        importer.textureCompression = TextureImporterCompression.Uncompressed;
        importer.maxTextureSize = 8192;

        var pivot = new Vector2(m.pivotX, m.pivotY);
#pragma warning disable 0618 // spritesheet is deprecated but still the simplest cross-version API
        importer.spritesheet = anim.rects.Select(r => new SpriteMetaData
        {
            name = r.name,
            rect = new Rect(r.x, r.y, r.w, r.h),
            alignment = (int)SpriteAlignment.Custom,
            pivot = pivot,
        }).ToArray();
#pragma warning restore 0618
        importer.SaveAndReimport();
    }

    static AnimationClip CreateClip(string texPath, Anim anim, string outDir)
    {
        var sprites = AssetDatabase.LoadAllAssetsAtPath(texPath).OfType<Sprite>()
            .OrderBy(s => s.name, StringComparer.Ordinal).ToArray();

        var clip = new AnimationClip { frameRate = anim.fps };
        var binding = EditorCurveBinding.PPtrCurve("", typeof(SpriteRenderer), "m_Sprite");
        var keys = new ObjectReferenceKeyframe[sprites.Length];
        for (int i = 0; i < sprites.Length; i++)
            keys[i] = new ObjectReferenceKeyframe { time = i / (float)anim.fps, value = sprites[i] };
        AnimationUtility.SetObjectReferenceCurve(clip, binding, keys);

        var settings = AnimationUtility.GetAnimationClipSettings(clip);
        settings.loopTime = anim.loop;
        settings.stopTime = sprites.Length / (float)anim.fps;
        AnimationUtility.SetAnimationClipSettings(clip, settings);

        string clipPath = outDir + "/" + anim.name + ".anim";
        AssetDatabase.DeleteAsset(clipPath);
        AssetDatabase.CreateAsset(clip, clipPath);
        return clip;
    }

    // Parameters:
    //   Speed (float): 0 = Idle, > 0.1 = Walk, > 2 = Run
    //   Dance (bool), Jump / Backflip / FallOver (triggers)
    //   Wave / Floss / Dab / Tumble (bools), Cannonball / Shake / FindGun / Shoot / SuperheroLanding (triggers)
    // FallOver always continues into StandUp, then back to Idle.
    static void CreateController(Dictionary<string, AnimationClip> clips, string outDir)
    {
        string path = outDir + "/Robot.controller";
        AssetDatabase.DeleteAsset(path);
        var controller = AnimatorController.CreateAnimatorControllerAtPath(path);
        controller.AddParameter("Speed", AnimatorControllerParameterType.Float);
        controller.AddParameter("Dance", AnimatorControllerParameterType.Bool);
        controller.AddParameter("Jump", AnimatorControllerParameterType.Trigger);
        controller.AddParameter("Backflip", AnimatorControllerParameterType.Trigger);
        controller.AddParameter("FallOver", AnimatorControllerParameterType.Trigger);

        var sm = controller.layers[0].stateMachine;
        var s = new Dictionary<string, AnimatorState>();
        int i = 0;
        foreach (var kv in clips)
        {
            var state = sm.AddState(kv.Key, new Vector3(260 + (i % 4) * 220, 60 + (i / 4) * 120));
            state.motion = kv.Value;
            s[kv.Key] = state;
            i++;
        }
        sm.defaultState = s["Idle"];

        // Locomotion
        Link(s["Idle"], s["Walk"], 0.1f, (AnimatorConditionMode.Greater, "Speed", 0.1f));
        Link(s["Walk"], s["Idle"], 0.1f, (AnimatorConditionMode.Less, "Speed", 0.1f));
        Link(s["Walk"], s["Run"], 0.1f, (AnimatorConditionMode.Greater, "Speed", 2f));
        Link(s["Run"], s["Walk"], 0.1f, (AnimatorConditionMode.Less, "Speed", 2f));

        // Dance
        Link(s["Idle"], s["Dance"], 0.1f, (AnimatorConditionMode.If, "Dance", 0));
        Link(s["Dance"], s["Idle"], 0.1f, (AnimatorConditionMode.IfNot, "Dance", 0));

        // One-shots from any grounded state
        foreach (var from in new[] { "Idle", "Walk", "Run", "Dance" })
        {
            Link(s[from], s["Jump"], 0.05f, (AnimatorConditionMode.If, "Jump", 0));
            Link(s[from], s["Backflip"], 0.05f, (AnimatorConditionMode.If, "Backflip", 0));
            Link(s[from], s["FallOver"], 0.05f, (AnimatorConditionMode.If, "FallOver", 0));
        }
        ExitTo(s["Jump"], s["Idle"]);
        ExitTo(s["Backflip"], s["Idle"]);
        ExitTo(s["FallOver"], s["StandUp"]);
        ExitTo(s["StandUp"], s["Idle"]);

        // Extra moves (Wave, Floss, Dab, Cannonball, Shake, FindGun, Shoot, Tumble, SuperheroLanding):
        // looping ones get a bool, one-shots get a trigger, all named after the clip.
        var core = new HashSet<string> { "Idle", "Walk", "Run", "Jump", "FallOver", "Dance", "Backflip", "StandUp" };
        foreach (var kv in s)
        {
            if (core.Contains(kv.Key)) continue;
            bool loop = clips[kv.Key].isLooping;
            controller.AddParameter(kv.Key, loop ? AnimatorControllerParameterType.Bool : AnimatorControllerParameterType.Trigger);
            if (loop)
            {
                Link(s["Idle"], kv.Value, 0.1f, (AnimatorConditionMode.If, kv.Key, 0));
                Link(kv.Value, s["Idle"], 0.1f, (AnimatorConditionMode.IfNot, kv.Key, 0));
            }
            else
            {
                foreach (var from in new[] { "Idle", "Walk", "Run" })
                    Link(s[from], kv.Value, 0.05f, (AnimatorConditionMode.If, kv.Key, 0));
                ExitTo(kv.Value, s["Idle"]);
            }
        }
    }

    static void Link(AnimatorState from, AnimatorState to, float duration, (AnimatorConditionMode mode, string param, float threshold) cond)
    {
        var t = from.AddTransition(to);
        t.hasExitTime = false;
        t.duration = duration;
        t.AddCondition(cond.mode, cond.threshold, cond.param);
    }

    static void ExitTo(AnimatorState from, AnimatorState to)
    {
        var t = from.AddTransition(to);
        t.hasExitTime = true;
        t.exitTime = 1f;
        t.duration = 0f;
    }
}
#endif
