"""Program v1 (2026-10-19) seed generator.

Usage: python3 supabase/generators/program_v1.py OUT.sql CHUNK_DIR

One definition of the canonical program; emits the idempotent seed SQL, the
same SQL split into chunks for the Supabase connector, and a dry-run summary.
"""
import json
import sys
from pathlib import Path

OUT_MIGRATION = Path(sys.argv[1])
OUT_CHUNKS = Path(sys.argv[2])
VERSION = "program v1, 2026-10-19"
PROGRAM = "ACL return"

# ---------------------------------------------------------------- library cues
CUES = {
    "Barbell Pin Squat (to 90°)": "Pins at 90°. Touch, don't bounce.",
    "Goblet Box Squat (to 90°)": "Sit to the box at 90°; stand without rocking.",
    "Cuff Knee Extension (90→45°)": "3 s down, stop at 45° until full-range gate.",
    "Cuff Knee Extension (90→0°)": "3 s down to full extension, no swing.",
    "Barbell Hip Thrust": "Ribs down, pause 1 s at the top.",
    "Single-Leg Calf Raise": "Full stretch off the plate, 1 s pause on top.",
    'DB Step-Up (12")': "Push through the top foot only.",
    "DB Step-Up (bench)": "Push through the top foot only.",
    "Split Squat (to 90°)": "Front knee to 90°, tracking over the toes.",
    "Rear-Foot-Elevated Split Squat (to 90°)": "Weight on the front leg; knee tracks over the toes.",
    "Slider Hamstring Curl": "Hips up the whole set; slide out slowly.",
    "Copenhagen Side Plank (short lever)": "Knee on the bench, hips stacked, body straight.",
    "Copenhagen Side Plank (long lever)": "Ankle on the bench, hips stacked, body straight.",
    "Perturbation Balance": "Soft knee, level hips; recover without hopping.",
    "Perturbation Balance (cushion)": "Soft knee, level hips; recover without hopping.",
    "Gait Drill": "Heel first, straighten the knee, even steps to the beat.",
    "Squat to Calf Raise": "Smooth squat, drive up onto the toes.",
    "Snap-Down to Stick": "Land quiet, knees over toes, hold 2 s.",
    "Double-Leg Pogo (low)": "Stiff ankles, small quiet bounces.",
    "Double-Leg Pogo": "Stiff ankles, quick contacts, quiet landings.",
    "Spanish Squat": "Band behind the knees, shins vertical, no deeper than 60°.",
    "Isometric Knee Extension (90°)": "5-s ramp, don't jerk; strap level and perpendicular to the shin.",
    "Isometric Knee Extension (60°)": "5-s ramp, don't jerk; strap level and perpendicular to the shin.",
    "Heel-Elevated Goblet Squat (to 90°)": "Heels up, torso tall, knees forward over the toes.",
    "DB Single-Leg RDL": "Hinge at the hip, hips square, soft knee.",
    "Bent-Knee Calf Raise": "Seated, DB on the knee, full range.",
    "Barbell Back Squat (to parallel)": "Brace, sit between the hips, drive up evenly.",
    "Nordic Curl (eccentric, band-assisted)": "Lower as slow as you can; catch with hands.",
    'Eccentric Lateral Step-Down (6")': "4 s down, tap the heel, knee over the second toe.",
    "Drop-Squat Landing": "Drop fast to a quarter squat, land quiet, stick it.",
    'Box Jump (12", step down)': "Land soft on the box; step down, never jump down.",
    'Box Jump (18", step down)': "Land soft on the box; step down, never jump down.",
    "Single-Leg Hop in Place": "Quiet landings, knee over the toes.",
    "Front Squat": "Elbows high, torso upright, knees forward.",
    "Suitcase Carry": "Stand tall; don't lean toward the weight.",
    "Jump Squat": "Full reset each rep; land soft and stick.",
    "Box Squat (fast concentric)": "Sit to the box, explode up.",
    "Single-Leg Broad Jump to Stick": "Jump forward, land on the same leg, hold 2 s.",
    "Broad Jump to Stick": "Two-foot jump, land quiet, hold 2 s.",
    "Lateral Bound to Stick": "Stick the landing for 2 s before the next rep.",
    "Lead-Leg Posting Drill": "Step and post onto the left, hold 2 s, knee over the foot.",
    "Band Step-and-Rotate": "Step, then turn through the hips, not the knee.",
    'Depth Drop to Stick (12")': "Step off, land quiet, stick 2 s.",
    "Single-Leg Forward Hops (x3)": "Three hops in a row; stick the last one.",
    "Deceleration Drill": "Accelerate 5 m, stop in two steps, hips low.",
    "45° Cut": "Plant the outside foot, hips low, knee over the toes.",
    "Shuffle-to-Sprint (10 m)": "Two shuffles, then sprint 10 m.",
    "Sprint Acceleration (10–20 m)": "Push the ground back; build to speed.",
    "Cutting (45°→90°)": "Hips low into the cut, knee over the toes.",
    "Lateral Shuffle / Reactive Drill": "Stay low, react, don't cross the feet.",
    "Single-Leg Bound": "Bound onto the other leg; stick each landing.",
    "Single-Leg Landing to Stick": "Land on one leg, knee over the toes, hold 2 s.",
    "Ankle Dorsiflexion Knee-to-Wall": "Heel down, drive the knee past the toes.",
    "Barbell Bench Press": "Feet flat; do not tuck the left foot under the bench.",
    "Incline Dumbbell Press": "Shoulder blades back; control the bottom.",
    "Dumbbell Shoulder Press": "Ribs down, press straight up.",
    "Lateral Raise": "Lead with the elbows; stop at shoulder height.",
    "Tricep Extension": "Elbows in, full stretch.",
    "Dead Bug": "Low back flat on the floor; exhale as you reach.",
    "Weighted Dead Bug": "Low back flat on the floor; exhale as you reach.",
    "Pull-Up": "Reach the bar from the bench; step down with the right leg. No jumping or dropping.",
    "Chin-Up": "Reach the bar from the bench; step down with the right leg. No jumping or dropping.",
    "Dumbbell Row": "Bench-supported; pull to the hip.",
    "Face Pull": "Pull to the eyes, thumbs back.",
    "Rear Delt Fly": "Chest on the incline bench; lead with the pinkies.",
    "Dumbbell Curl": "No swing, full range.",
    "Close-Grip Bench Press": "Feet flat; elbows tucked.",
    "Hammer Curl": "Neutral grip, no swing.",
    "Band Anti-Rotation Press": "Stand or half-kneel on the right knee; don't let the band turn you.",
    "Plank": "Squeeze the glutes, ribs down.",
}

QUAD = {
    "Barbell Pin Squat (to 90°)", "Goblet Box Squat (to 90°)",
    "Cuff Knee Extension (90→45°)", "Cuff Knee Extension (90→0°)",
    'DB Step-Up (12")', "DB Step-Up (bench)", "Split Squat (to 90°)",
    "Rear-Foot-Elevated Split Squat (to 90°)",
    "Heel-Elevated Goblet Squat (to 90°)", "Barbell Back Squat (to parallel)",
    "Front Squat",
}


def ex(order, name, part, cat, sets, reps=None, *, muscle=None, ready="any",
       measure="reps", side="bilateral", load="bodyweight", rir=None,
       secs=None, dist=None, tempo=None, gate=None, gate2=None, sub=None,
       sub_load=None, sub_reps=None, fw=None, uw=None, notes=None):
    smin, smax = (sets, sets) if isinstance(sets, int) else sets
    if reps is None:
        rmin = rmax = None
    elif isinstance(reps, int):
        rmin = rmax = reps
    else:
        rmin, rmax = reps
    srmin = srmax = None
    if sub_reps is not None:
        srmin, srmax = (sub_reps, sub_reps) if isinstance(sub_reps, int) else sub_reps
    assert name in CUES, name
    if sub:
        assert sub in CUES, sub
    return dict(order=order, name=name, part=part, cat=cat, muscle=muscle,
                ready=ready, measure=measure, side=side, load=load,
                smin=smin, smax=smax, rmin=rmin, rmax=rmax, rir=rir,
                secs=secs, dist=dist, tempo=tempo, gate=gate, gate2=gate2,
                sub=sub, sub_load=sub_load, srmin=srmin, srmax=srmax,
                fw=fw, uw=uw, quad=name in QUAD, cue=CUES[name], notes=notes)


L, U = "legs", "upper"
PER_LEG, PER_SIDE = "per_leg", "per_side"
DB, BB, BW, BAND, CUFF = "dumbbell", "barbell", "bodyweight", "band", "cuff"

# ------------------------------------------------------------ Block 1 Build
def b1_mon():
    return [
        ex(10, "Barbell Pin Squat (to 90°)", L, "main", 4, (10, 12), muscle="quads", load=BB, rir=2,
           gate="barbell", sub="Goblet Box Squat (to 90°)", sub_load=DB),
        ex(11, "Cuff Knee Extension (90→45°)", L, "accessory", 3, (12, 15), muscle="quads", side=PER_LEG,
           load=CUFF, rir=1, tempo="3 s lowering",
           notes="Seated on the bench; plate or DB hung from the ankle cuff. Left first."),
        ex(12, "Barbell Hip Thrust", L, "main", 3, (10, 12), muscle="glutes", load=BB, rir=2),
        ex(13, "Single-Leg Calf Raise", L, "accessory", 3, (12, 15), muscle="calves", side=PER_LEG, load=DB,
           rir=1, notes="Off a plate, DB in hand. Left first."),
        ex(30, "Barbell Bench Press", U, "main", 3, (8, 10), load=BB, rir=2),
        ex(31, "Incline Dumbbell Press", U, "accessory", 3, (10, 12), load=DB, rir=2),
        ex(32, "Dumbbell Shoulder Press", U, "accessory", 3, (10, 12), load=DB, rir=2, notes="Seated."),
        ex(33, "Lateral Raise", U, "accessory", 3, (15, 20), load=DB, rir=2),
        ex(34, "Tricep Extension", U, "accessory", 2, (12, 15), load=DB, rir=2, notes="Seated, overhead."),
        ex(50, "Dead Bug", U, "core", 3, 10, side=PER_SIDE,
           notes="Down to the floor leading with the right leg."),
    ]


def b1_wed():
    return [
        ex(10, 'DB Step-Up (12")', L, "main", 3, (10, 12), muscle="quads", side=PER_LEG, load=DB, rir=2,
           tempo="3 s lowering", notes="No push-off from the bottom foot. Left first."),
        ex(11, "Split Squat (to 90°)", L, "main", 3, (10, 12), muscle="quads", side=PER_LEG, load=DB, rir=2,
           uw=10, notes="Left first."),
        ex(12, "Rear-Foot-Elevated Split Squat (to 90°)", L, "main", 3, (10, 12), muscle="quads",
           side=PER_LEG, load=DB, rir=2, fw=11,
           notes="Rear foot on a plate stack, then a low step. Front knee to 90°. Left first."),
        ex(13, "Slider Hamstring Curl", L, "accessory", 3, (10, 12), muscle="hamstrings", rir=1,
           notes="Bridge position."),
        ex(30, "Pull-Up", U, "main", 4, (2, 4), rir=1,
           notes="Stop 1 rep short of failure. Baseline about 4/3/3/2."),
        ex(31, "Dumbbell Row", U, "accessory", 4, (10, 12), load=DB, rir=2, notes="1-arm, bench-supported."),
        ex(32, "Face Pull", U, "accessory", 3, (15, 20), load=BAND, rir=2),
        ex(33, "Rear Delt Fly", U, "accessory", 3, 15, load=DB, rir=2,
           notes="Chest-supported on the incline bench."),
        ex(34, "Dumbbell Curl", U, "accessory", 2, (12, 15), load=DB, rir=2),
        ex(50, "Copenhagen Side Plank (short lever)", L, "core", 3, muscle="adductors", measure="time",
           side=PER_SIDE, secs=20, notes="Knee on the bench."),
        ex(51, "Perturbation Balance", L, "mobility", 3, measure="time", side=PER_LEG, secs=30,
           notes="Band tug or ball toss. Left first."),
        ex(52, "Gait Drill", L, "mobility", 1, measure="time", secs=300,
           notes="Slow march, then step-throughs to a metronome at preferred cadence +5%."),
    ]


def b1_fri():
    landing = "Landing prep. Normal knee check only."
    return [
        ex(0, "Squat to Calf Raise", L, "plyo", 2, 10, ready="normal", fw=10, notes=landing),
        ex(1, "Snap-Down to Stick", L, "plyo", 3, 5, ready="normal", fw=10, notes=landing),
        ex(2, "Double-Leg Pogo (low)", L, "plyo", 2, 10, ready="normal", fw=10, notes=landing),
        ex(10, "Spanish Squat", L, "accessory", 3, muscle="quads", measure="time", load=BAND, secs=45,
           notes="Heavy band, no deeper than 60°."),
        ex(11, "Isometric Knee Extension (90°)", L, "accessory", 5, muscle="quads", measure="force",
           side=PER_LEG, secs=5, notes="Strapped, crane scale; log peak N. 45 s rest. Left first."),
        ex(12, "Heel-Elevated Goblet Squat (to 90°)", L, "main", 3, 12, muscle="quads", load=DB, rir=2,
           tempo="3-1-1"),
        ex(13, "DB Single-Leg RDL", L, "accessory", 3, 10, muscle="hamstrings", side=PER_LEG, load=DB,
           rir=2, notes="Left first."),
        ex(14, "Bent-Knee Calf Raise", L, "accessory", 3, 15, muscle="calves", load=DB, rir=1,
           notes="Seated, DB on the knee."),
        ex(30, "Close-Grip Bench Press", U, "main", 3, (8, 10), load=BB, rir=2),
        ex(31, "Chin-Up", U, "main", 3, (3, 5), rir=1, notes="Stop 1 rep short of failure."),
        ex(32, "Hammer Curl", U, "accessory", 2, (12, 15), load=DB, rir=2),
        ex(50, "Band Anti-Rotation Press", U, "core", 3, 10, side=PER_SIDE, load=BAND,
           notes="Pallof press. Standing, or half-kneeling on the right knee only."),
    ]


def onramp(rows):
    """Block 0: Block 1's exercises; main legs 2-3 x 12 @ RIR 3-4, accessories 2 x 12 @ RIR 3."""
    out = []
    for r in rows:
        r = dict(r)
        if r["part"] == L and r["measure"] == "reps" and r["cat"] in ("main", "accessory"):
            if r["cat"] == "main":
                r.update(smin=2, smax=3, rmin=12, rmax=12, rir=3)
            else:
                r.update(smin=2, smax=2, rmin=12, rmax=12, rir=3)
        out.append(r)
    return out

# ------------------------------------------------------------ Block 2 Strength
def b2_mon():
    return [
        ex(10, "Barbell Back Squat (to parallel)", L, "main", 4, (6, 8), muscle="quads", load=BB, rir=2,
           gate="depth_past_90", gate2="barbell", sub="Barbell Pin Squat (to 90°)", sub_load=BB),
        ex(11, "Cuff Knee Extension (90→0°)", L, "accessory", 3, (10, 12), muscle="quads", side=PER_LEG,
           load=CUFF, rir=1, tempo="3 s lowering", gate="ke_full_range",
           sub="Cuff Knee Extension (90→45°)", sub_load=CUFF, notes="Left first."),
        ex(12, "Barbell Hip Thrust", L, "main", 4, (6, 8), muscle="glutes", load=BB, rir=2),
        ex(13, "Nordic Curl (eccentric, band-assisted)", L, "accessory", 3, (3, 5), muscle="hamstrings",
           tempo="5 s lowering", gate="nordic", sub="Slider Hamstring Curl", sub_load=BW, sub_reps=10,
           notes="Band-assisted from the rack. Fallback: slider hamstring curl 3 x 10."),
        ex(14, "Single-Leg Calf Raise", L, "accessory", 3, (10, 12), muscle="calves", side=PER_LEG,
           load=DB, rir=1, notes="Heavier DB. Left first."),
        ex(30, "Barbell Bench Press", U, "main", 4, (5, 7), load=BB, rir=2),
        ex(31, "Incline Dumbbell Press", U, "accessory", 3, (8, 10), load=DB, rir=2),
        ex(32, "Dumbbell Shoulder Press", U, "accessory", 3, (8, 10), load=DB, rir=2, notes="Standing."),
        ex(33, "Lateral Raise", U, "accessory", 3, (12, 15), load=DB, rir=2),
        ex(34, "Tricep Extension", U, "accessory", 3, (10, 12), load=DB, rir=2, notes="Overhead."),
        ex(50, "Weighted Dead Bug", U, "core", 3, 10, side=PER_SIDE, load=DB,
           notes="Or a long-lever plank, 30 s."),
    ]


def b2_wed():
    return [
        ex(10, "Rear-Foot-Elevated Split Squat (to 90°)", L, "main", 4, (6, 8), muscle="quads",
           side=PER_LEG, load=DB, rir=2,
           notes="Rear foot on the bench. Front knee to 90° until depth_past_90 is cleared. Left first."),
        ex(11, "DB Step-Up (bench)", L, "main", 3, 8, muscle="quads", side=PER_LEG, load=DB, rir=2,
           gate="depth_past_90", sub='DB Step-Up (12")', sub_load=DB,
           notes='About 17". Fallback: 12" step with heavier DBs. Left first.'),
        ex(12, 'Eccentric Lateral Step-Down (6")', L, "accessory", 3, 8, muscle="quads", side=PER_LEG,
           tempo="4 s lowering", notes="Skip if graft-site pain is above 2. Left first."),
        ex(13, "DB Single-Leg RDL", L, "accessory", 3, 8, muscle="hamstrings", side=PER_LEG, load=DB,
           rir=2, notes="Left first."),
        ex(30, "Pull-Up", U, "main", (4, 5), (4, 6), rir=1, notes="Weighted once 30 total reps."),
        ex(31, "Dumbbell Row", U, "accessory", 4, (8, 10), load=DB, rir=2),
        ex(32, "Face Pull", U, "accessory", 3, (15, 20), load=BAND, rir=2),
        ex(33, "Rear Delt Fly", U, "accessory", 3, (12, 15), load=DB, rir=2),
        ex(34, "Dumbbell Curl", U, "accessory", 3, (10, 12), load=DB, rir=2),
        ex(50, "Copenhagen Side Plank (long lever)", L, "core", 3, muscle="adductors", measure="time",
           side=PER_SIDE, secs=20, notes="Ankle on the bench. Fallback: short lever."),
        ex(51, "Perturbation Balance (cushion)", L, "mobility", 3, measure="time", side=PER_LEG, secs=30,
           notes="Left first."),
    ]


def b2_fri():
    plyo = "Normal knee check only. Stop a set if landings get noisy or the knee caves in."
    return [
        ex(0, "Double-Leg Pogo", L, "plyo", 3, 15, ready="normal", gate="plyo_double",
           sub="Squat to Calf Raise", sub_reps=10, notes=plyo),
        ex(1, "Drop-Squat Landing", L, "plyo", 3, 5, ready="normal", gate="plyo_double",
           sub="Snap-Down to Stick", notes=plyo),
        ex(2, 'Box Jump (12", step down)', L, "plyo", 4, 3, ready="normal", gate="plyo_double",
           sub="Double-Leg Pogo (low)", sub_reps=10, notes=plyo),
        ex(3, "Single-Leg Hop in Place", L, "plyo", 2, 10, ready="normal", side=PER_LEG,
           gate="plyo_single", notes="Left first. " + plyo),
        ex(10, "Front Squat", L, "main", 4, (6, 8), muscle="quads", load=BB, rir=2,
           gate="depth_past_90", gate2="barbell", sub="Heel-Elevated Goblet Squat (to 90°)",
           sub_load=DB, sub_reps=8, notes="Fallback: heavy heel-elevated goblet squat to 90°, 4 x 8."),
        ex(11, "Isometric Knee Extension (60°)", L, "accessory", 3, muscle="quads", measure="force",
           side=PER_LEG, secs=5, notes="Strapped, crane scale; log peak N. Left first."),
        ex(12, "Isometric Knee Extension (90°)", L, "accessory", 3, muscle="quads", measure="force",
           side=PER_LEG, secs=5, notes="Strapped, crane scale; log peak N. Left first."),
        ex(13, "Spanish Squat", L, "accessory", 3, muscle="quads", measure="time", load=BAND, secs=45,
           notes="Heavier band."),
        ex(14, "Bent-Knee Calf Raise", L, "accessory", 3, (12, 15), muscle="calves", load=DB, rir=1),
        ex(30, "Close-Grip Bench Press", U, "main", 4, (6, 8), load=BB, rir=2),
        ex(31, "Chin-Up", U, "main", 4, (4, 6), rir=1, notes="Weighted once 30 total reps."),
        ex(32, "Hammer Curl", U, "accessory", 3, (10, 12), load=DB, rir=2),
        ex(50, "Suitcase Carry", U, "core", 3, measure="distance", side=PER_SIDE, load=DB, dist=30,
           notes="Heavy DB. Or 40 s per side."),
    ]

# ------------------------------------------------------ Block 3 Heavy + Power
def b3_mon(main_sets=5, main_reps=(3, 5), rir=2, jump_sets=4):
    return [
        ex(0, "Jump Squat", L, "plyo", jump_sets, 3, ready="normal", load=DB, gate="plyo_double",
           sub="Box Squat (fast concentric)", sub_load=BB,
           notes="Bodyweight, building to DBs at 20% of the squat load. Fallback: box squat, fast up, at 50%."),
        ex(10, "Barbell Back Squat (to parallel)", L, "main", main_sets, main_reps, muscle="quads",
           load=BB, rir=rir, gate="depth_past_90", gate2="barbell", sub="Barbell Pin Squat (to 90°)",
           sub_load=BB),
        ex(11, "Cuff Knee Extension (90→0°)", L, "accessory", 3, (8, 10), muscle="quads", side=PER_LEG,
           load=CUFF, rir=1, gate="ke_full_range", sub="Cuff Knee Extension (90→45°)", sub_load=CUFF,
           notes="Left first."),
        ex(12, "Barbell Hip Thrust", L, "main", 4, (main_reps if main_sets == 4 else 5), muscle="glutes",
           load=BB, rir=rir),
        ex(13, "Nordic Curl (eccentric, band-assisted)", L, "accessory", 3, 5, muscle="hamstrings",
           tempo="5 s lowering", gate="nordic", sub="Slider Hamstring Curl", sub_load=BW, sub_reps=10),
        ex(14, "Single-Leg Calf Raise", L, "accessory", 3, (8, 10), muscle="calves", side=PER_LEG,
           load=DB, rir=1, notes="Heavy. Left first."),
        ex(30, "Barbell Bench Press", U, "main", main_sets, main_reps, load=BB, rir=rir),
        ex(31, "Dumbbell Shoulder Press", U, "accessory", 3, (6, 8), load=DB, rir=2, notes="Standing."),
        ex(32, "Incline Dumbbell Press", U, "accessory", 3, 8, load=DB, rir=2),
        ex(33, "Lateral Raise", U, "accessory", 3, (12, 15), load=DB, rir=2),
        ex(34, "Tricep Extension", U, "accessory", 3, 10, load=DB, rir=2, notes="Overhead."),
        ex(50, "Plank", U, "core", 3, measure="time", secs=40, notes="Any plank variation."),
    ]


def b3_wed(rfess_sets=4, rfess_reps=5, rir=2, bounds=True, pull=(5, (3, 5))):
    rows = [
        ex(0, "Single-Leg Broad Jump to Stick", L, "plyo", 3, 3, ready="normal", side=PER_LEG,
           gate="plyo_single", sub="Broad Jump to Stick", notes="Left first."),
    ]
    if bounds:
        rows.append(ex(1, "Lateral Bound to Stick", L, "plyo", 3, 4, ready="normal", side=PER_SIDE,
                       gate="plyo_single"))
    rows += [
        ex(10, "Rear-Foot-Elevated Split Squat (to 90°)", L, "main", rfess_sets, rfess_reps,
           muscle="quads", side=PER_LEG, load=DB, rir=rir,
           notes="Heavy. Front knee to 90° until depth_past_90 is cleared. Left first."),
        ex(11, "DB Single-Leg RDL", L, "accessory", 4, 6, muscle="hamstrings", side=PER_LEG, load=DB,
           rir=2, notes="Left first."),
        ex(20, "Lead-Leg Posting Drill", L, "accessory", 3, 6, ready="normal",
           notes="Golf prep, left as lead: step and post onto the left, hold 2 s."),
        ex(21, "Band Step-and-Rotate", L, "accessory", 3, 6, ready="normal", side=PER_SIDE, load=BAND,
           notes="Golf prep."),
        ex(30, "Pull-Up", U, "main", pull[0], pull[1], rir=1, notes="Weighted."),
        ex(31, "Dumbbell Row", U, "accessory", 4, (6, 8), load=DB, rir=2),
        ex(32, "Face Pull", U, "accessory", 3, (15, 20), load=BAND, rir=2),
        ex(33, "Rear Delt Fly", U, "accessory", 3, (12, 15), load=DB, rir=2),
        ex(34, "Dumbbell Curl", U, "accessory", 3, (8, 10), load=DB, rir=2),
        ex(50, "Copenhagen Side Plank (long lever)", L, "core", 3, muscle="adductors", measure="time",
           side=PER_SIDE, secs=25, sub=None, notes="Ankle on the bench."),
    ]
    return rows


def friday_strength_tail(front_sets=4, front_reps=(4, 6), cgb=(4, (5, 6)), rir=2, front_note=None):
    return [
        ex(10, "Front Squat", L, "main", front_sets, front_reps, muscle="quads", load=BB, rir=rir,
           gate="depth_past_90", gate2="barbell", sub="Heel-Elevated Goblet Squat (to 90°)",
           sub_load=DB, notes=front_note or "Fallback: heavy heel-elevated goblet squat to 90°."),
        ex(11, "Isometric Knee Extension (60°)", L, "accessory", 3, muscle="quads", measure="force",
           side=PER_LEG, secs=5, notes="Strapped, crane scale; log peak N. Left first."),
        ex(12, "Isometric Knee Extension (90°)", L, "accessory", 3, muscle="quads", measure="force",
           side=PER_LEG, secs=5, notes="Strapped, crane scale; log peak N. Left first."),
        ex(13, "Bent-Knee Calf Raise", L, "accessory", 3, 12, muscle="calves", load=DB, rir=1),
        ex(30, "Close-Grip Bench Press", U, "main", cgb[0], cgb[1], load=BB, rir=rir),
        ex(31, "Chin-Up", U, "main", 4, (4, 6), rir=1, notes="Weighted."),
        ex(32, "Hammer Curl", U, "accessory", 3, (8, 10), load=DB, rir=2),
        ex(50, "Suitcase Carry", U, "core", 3, measure="distance", side=PER_SIDE, load=DB, dist=30),
    ]


def b3_fri():
    return [
        ex(0, 'Box Jump (18", step down)', L, "plyo", 4, 3, ready="normal", gate="plyo_double"),
        ex(1, 'Depth Drop to Stick (12")', L, "plyo", 3, 3, ready="normal", gate="plyo_double"),
        ex(2, "Single-Leg Forward Hops (x3)", L, "plyo", 3, 3, ready="normal", side=PER_LEG,
           gate="plyo_single", notes="Three continuous hops per set. Left first."),
        ex(3, "Deceleration Drill", L, "plyo", 4, 4, ready="normal", gate="jog",
           notes="5 m accelerate, stick in 2 steps, 50–75% speed."),
    ] + friday_strength_tail()

# ---------------------------------------------------- Block 4 waves
def strength_wave_mon(main_sets, main_reps):
    rows = b3_mon(main_sets=main_sets, main_reps=main_reps, rir=1, jump_sets=3)
    return rows


def strength_wave_wed(main_sets, main_reps):
    return b3_wed(rfess_sets=main_sets, rfess_reps=main_reps, rir=1, bounds=False,
                  pull=(4, (4, 6)))


def strength_wave_fri(main_sets, main_reps):
    return [
        ex(0, "45° Cut", L, "plyo", 4, 3, ready="normal", side=PER_SIDE, gate="cutting",
           sub="Deceleration Drill", notes="50% → 75% speed."),
        ex(1, "Shuffle-to-Sprint (10 m)", L, "plyo", 4, 1, ready="normal", gate="cutting"),
    ] + friday_strength_tail(front_sets=main_sets, front_reps=main_reps,
                             cgb=(main_sets, main_reps), rir=1)


def power_mon():
    fast = "75–80% effort, moved fast."
    return [
        ex(10, "Barbell Back Squat (to parallel)", L, "main", 3, 3, muscle="quads", load=BB,
           gate="depth_past_90", gate2="barbell", sub="Barbell Pin Squat (to 90°)", sub_load=BB,
           notes=fast),
        ex(11, "Jump Squat", L, "plyo", 3, 3, ready="normal", load=DB, gate="plyo_double",
           notes="Contrast: right after each squat set."),
        ex(12, "Barbell Hip Thrust", L, "main", 3, 3, muscle="glutes", load=BB, notes=fast),
        ex(13, "Broad Jump to Stick", L, "plyo", 3, 3, ready="normal", gate="plyo_double",
           notes="Contrast: right after each hip thrust set."),
        ex(20, "Cuff Knee Extension (90→0°)", L, "accessory", 3, (8, 10), muscle="quads",
           side=PER_LEG, load=CUFF, rir=1, gate="ke_full_range", sub="Cuff Knee Extension (90→45°)",
           sub_load=CUFF, notes="Left first."),
        ex(21, "Nordic Curl (eccentric, band-assisted)", L, "accessory", 3, 5, muscle="hamstrings",
           tempo="5 s lowering", gate="nordic", sub="Slider Hamstring Curl", sub_load=BW, sub_reps=10),
        ex(22, "Single-Leg Calf Raise", L, "accessory", 3, (8, 10), muscle="calves", side=PER_LEG,
           load=DB, rir=1, notes="Heavy. Left first."),
        ex(30, "Barbell Bench Press", U, "main", 3, 3, load=BB, notes=fast),
        ex(31, "Dumbbell Shoulder Press", U, "accessory", 3, (6, 8), load=DB, rir=2, notes="Standing."),
        ex(32, "Incline Dumbbell Press", U, "accessory", 3, 8, load=DB, rir=2),
        ex(33, "Lateral Raise", U, "accessory", 3, (12, 15), load=DB, rir=2),
        ex(34, "Tricep Extension", U, "accessory", 3, 10, load=DB, rir=2, notes="Overhead."),
        ex(50, "Plank", U, "core", 3, measure="time", secs=40),
    ]


def power_wed():
    return [
        ex(10, "Rear-Foot-Elevated Split Squat (to 90°)", L, "main", 3, 3, muscle="quads",
           side=PER_LEG, load=DB, notes="75–80% effort, moved fast. Left first."),
        ex(11, "Single-Leg Bound", L, "plyo", 3, 3, ready="normal", side=PER_LEG, gate="plyo_single",
           notes="Contrast: right after each split squat set."),
        ex(20, "DB Single-Leg RDL", L, "accessory", 3, 6, muscle="hamstrings", side=PER_LEG, load=DB,
           rir=2, notes="Left first."),
        ex(21, "Lead-Leg Posting Drill", L, "accessory", 3, 6, ready="normal",
           notes="Golf prep, left as lead: step and post onto the left, hold 2 s."),
        ex(22, "Band Step-and-Rotate", L, "accessory", 3, 6, ready="normal", side=PER_SIDE, load=BAND,
           notes="Golf prep."),
        ex(30, "Pull-Up", U, "main", 4, (4, 6), rir=1, notes="Weighted."),
        ex(31, "Dumbbell Row", U, "accessory", 4, (6, 8), load=DB, rir=2),
        ex(32, "Face Pull", U, "accessory", 3, (15, 20), load=BAND, rir=2),
        ex(33, "Rear Delt Fly", U, "accessory", 3, (12, 15), load=DB, rir=2),
        ex(34, "Dumbbell Curl", U, "accessory", 3, (8, 10), load=DB, rir=2),
        ex(50, "Copenhagen Side Plank (long lever)", L, "core", 3, muscle="adductors", measure="time",
           side=PER_SIDE, secs=25, notes="Ankle on the bench."),
    ]


def power_fri():
    return [
        ex(0, "Sprint Acceleration (10–20 m)", L, "plyo", 6, 1, ready="normal", gate="jog",
           gate2="run_20min", notes="6 x 10–20 m, walk back between."),
        ex(1, "Cutting (45°→90°)", L, "plyo", 4, 3, ready="normal", side=PER_SIDE, gate="cutting",
           sub="Deceleration Drill", notes="45° → 90° cuts, 75% → 100% speed."),
        ex(2, "Lateral Shuffle / Reactive Drill", L, "plyo", 4, ready="normal", measure="time",
           secs=15, gate="jog"),
    ] + friday_strength_tail(front_sets=3, front_reps=3, cgb=(4, (5, 6)), rir=2,
                             front_note="75–80% effort, moved fast. Fallback: heavy heel-elevated goblet squat to 90°.")

# ---------------------------------------------------- Return to sport
def prevention(start):
    note = "Injury prevention, 15 min, permanent: the right ACL is now the higher-risk knee."
    return [
        ex(start, "Single-Leg Landing to Stick", L, "plyo", 2, 5, ready="normal", side=PER_LEG,
           notes=note),
        ex(start + 1, "Deceleration Drill", L, "plyo", 2, 4, ready="normal"),
        ex(start + 2, "Copenhagen Side Plank (long lever)", L, "core", 2, muscle="adductors",
           measure="time", side=PER_SIDE, secs=20),
        ex(start + 3, "Nordic Curl (eccentric, band-assisted)", L, "accessory", 2, 4,
           muscle="hamstrings", tempo="5 s lowering"),
        ex(start + 4, "Lateral Bound to Stick", L, "plyo", 2, 4, ready="normal", side=PER_SIDE),
        ex(start + 5, "Ankle Dorsiflexion Knee-to-Wall", L, "mobility", 2, 10, side=PER_LEG),
    ]


def rts_mon():
    rot = "Rotate rep ranges monthly."
    return [
        ex(10, "Barbell Back Squat (to parallel)", L, "main", (3, 4), (4, 8), muscle="quads", load=BB,
           rir=2, notes=rot),
        ex(11, "Barbell Hip Thrust", L, "main", (3, 4), (4, 8), muscle="glutes", load=BB, rir=2),
        ex(20, "Cuff Knee Extension (90→0°)", L, "accessory", 3, (8, 10), muscle="quads",
           side=PER_LEG, load=CUFF, rir=1),
        ex(21, "Single-Leg Calf Raise", L, "accessory", 3, (8, 12), muscle="calves", side=PER_LEG,
           load=DB, rir=1),
        ex(30, "Barbell Bench Press", U, "main", (3, 4), (4, 8), load=BB, rir=2, notes=rot),
        ex(31, "Dumbbell Shoulder Press", U, "accessory", 3, (6, 10), load=DB, rir=2),
        ex(32, "Lateral Raise", U, "accessory", 3, (12, 15), load=DB, rir=2),
    ] + prevention(40)


def rts_thu():
    return [
        ex(0, "Broad Jump to Stick", L, "plyo", 3, 3, ready="normal"),
        ex(10, "Rear-Foot-Elevated Split Squat (to 90°)", L, "main", (3, 4), (4, 8), muscle="quads",
           side=PER_LEG, load=DB, rir=2, notes="Left first."),
        ex(11, "DB Single-Leg RDL", L, "accessory", 3, (6, 8), muscle="hamstrings", side=PER_LEG,
           load=DB, rir=2),
        ex(30, "Pull-Up", U, "main", (3, 4), (4, 8), rir=1, notes="Weighted."),
        ex(31, "Dumbbell Row", U, "accessory", (3, 4), (6, 10), load=DB, rir=2),
        ex(32, "Face Pull", U, "accessory", 3, (15, 20), load=BAND, rir=2),
        ex(33, "Dumbbell Curl", U, "accessory", 3, (8, 12), load=DB, rir=2),
    ] + prevention(40)


def rts_sat():
    return [
        ex(10, "Front Squat", L, "main", 3, (4, 8), muscle="quads", load=BB, rir=2),
        ex(11, "Barbell Hip Thrust", L, "main", 3, (6, 8), muscle="glutes", load=BB, rir=2),
        ex(30, "Incline Dumbbell Press", U, "accessory", 3, (8, 10), load=DB, rir=2),
        ex(31, "Chin-Up", U, "main", 3, (4, 8), rir=1),
        ex(50, "Suitcase Carry", U, "core", 3, measure="distance", side=PER_SIDE, load=DB, dist=30),
        ex(51, "Plank", U, "core", 3, measure="time", secs=40),
    ]

# ---------------------------------------------------- sessions per block
WALK_JOG = ("walk_jog", "Walk-jog", None, None, None,
            "Stages: 1:1 x6 → 2:1 x6 → 3:1 x5 → 5:1 x4 → 10 min continuous → 15 → 20 → 30. "
            "Add 1–2 min of running after a normal next morning; otherwise 2 days off, then one stage back.",
            "jog", False, "Then Peloton Zone 2 for 15–20 min.")
WALK_JOG_B4 = WALK_JOG[:5] + (WALK_JOG[5] + " From week 23: run 2–3x a week, weekly run minutes up 10% at most.",) + WALK_JOG[6:]
TEST_DAY = ("test", "Test day + walk", None, None, None,
            "Tests in the PT Tracker, then a 30 min walk. Weekly Zone 2 target: 150 min (rides and walks).",
            None, False, None)
GOLF_SHORT = ("golf", "Golf: short game", None, None, None,
              "Putting and chipping, 1–2x a week. Log balls hit in the notes; check the knee next morning.",
              "golf_short", True, None)
GOLF_FULL = ("golf", "Golf: full swing (staged)", None, None, None,
             "Half wedges → half irons → full irons → driver last. Each stage 2 weeks minimum with a normal next morning.",
             "golf_full", True, None)
Z2_TUE = ("peloton", "Peloton Zone 2", "zone2", 30, 45, None, None, False, None)
Z2_SAT = ("peloton", "Peloton Zone 2 (long)", "zone2", 45, 60, None, None, False, None)
THU_Z2 = ("peloton", "Peloton Zone 2", "zone2", 30, 45, None, None, False, None)
THU_CLIMB = ("peloton", "Peloton climb intervals", "climb_intervals", 45, 45,
             "10 min warm-up; 5 x 3 min seated, cadence 60–70, RPE 7, 3 min easy between; cool-down.",
             None, False, None)
THU_4X4 = ("peloton", "Peloton 4 x 4", "threshold_intervals", 40, 45,
           "10 min warm-up; 4 x 4 min at RPE 8 (standing allowed if the knee check is normal), 3 min easy between; cool-down.",
           None, False, None)
THU_VO2 = ("peloton", "Peloton VO2 max", "vo2_intervals", 45, 45,
           "10 min warm-up; 4 x 4 min at RPE 8–9, 4 min easy between; cool-down.", None, False, None)
THU_VO2_ALT = ("peloton", "Peloton VO2 max", "vo2_intervals", 40, 45,
               "Odd post-op weeks: 4 x 4 min at RPE 8–9, 4 min easy between. Even weeks: 8 x 30 s hard / 90 s easy. "
               "10 min warm-up and cool-down.", None, False, None)

MON_NOTE = "Legs first, then Push, then core."
WED_NOTE = "PT morning. Legs, then Pull, then core and balance."
FRI_NOTE = "PT morning. Plyos first (normal knee check only), then quad work, then Arms."


def lift(name, rows, note, optional=False):
    return ("lift", name, None, None, None, None, None, optional, note, rows)


def week_shape(mon, wed, fri, thu, walk_jog=True, golf=False, b4=False):
    s = {
        (1, 0): lift(mon[0], mon[1], MON_NOTE),
        (3, 0): lift(wed[0], wed[1], WED_NOTE),
        (5, 0): lift(fri[0], fri[1], FRI_NOTE),
        (2, 1): Z2_TUE,
        (4, 1): thu,
        (6, 1): Z2_SAT,
        (0, 0): TEST_DAY,
    }
    if walk_jog:
        wj = WALK_JOG_B4 if b4 else WALK_JOG
        s[(2, 0)] = wj
        s[(6, 0)] = wj
    if golf:
        s[(6, 2)] = GOLF_SHORT
        s[(6, 3)] = GOLF_FULL
    return s


B1 = (("Heavy legs + Push", b1_mon()), ("Single-leg + Pull", b1_wed()), ("Quad isolation + Arms", b1_fri()))
BLOCKS = [
    # name, start, end, (sets_min, sets_max, reps_min, reps_max, rir), rep_scheme, notes, sessions_from, activation, gate, fallback, sessions
    dict(name="On-ramp", start=9, end=9, scheme=(2, 3, 12, 12, 3),
         rep_scheme="Main 2–3 x 12 @ RIR 3–4; accessories 2 x 12 @ RIR 3; upper unchanged.",
         notes="First loaded leg week: find loads. Every first set is \"find load\".",
         sessions=week_shape(("Heavy legs + Push", onramp(b1_mon())), ("Single-leg + Pull", onramp(b1_wed())),
                             ("Quad isolation + Arms", onramp(b1_fri())), THU_Z2, walk_jog=False)),
    dict(name="Block 1 Build", start=10, end=12, scheme=(3, 4, 10, 12, 2),
         rep_scheme="Main 3–4 x 10–12 @ RIR 2; accessories 3 x 10–15 @ RIR 1–2.",
         notes=None, sessions=week_shape(*B1, THU_CLIMB)),
    dict(name="Deload + Test", start=13, end=13, scheme=None, sessions_from="Block 1 Build",
         rep_scheme="Block 1 at deload volume: one set off, no load increases, plyo halved.",
         notes="Full test battery Sunday 11/22 (PT Tracker)."),
    dict(name="Block 2 Strength", start=14, end=17, scheme=(4, 4, 6, 8, 2),
         rep_scheme="Main 4 x 6–8 @ RIR 2; accessories 3 x 8–12. Plyos: quality only.",
         notes="Suggested start for main lifts: Block 1's top 10-rep load x 1.1 (the engine does this).",
         sessions=week_shape(("Heavy legs + Push", b2_mon()), ("Single-leg + Pull", b2_wed()),
                             ("Power intro + quad + Arms", b2_fri()), THU_4X4)),
    dict(name="Deload", start=18, end=18, scheme=None, sessions_from="Block 2 Strength",
         rep_scheme="Block 2 at deload volume.", notes="Holiday week. Test Sunday 12/27."),
    dict(name="Block 3 Heavy + Power", start=19, end=22, scheme=(4, 5, 3, 5, 2),
         rep_scheme="Main 4–5 x 3–5 @ RIR 2. Power before strength.",
         notes="Week 22 Sunday: first hop test battery (PT Tracker).",
         sessions=week_shape(("Heavy legs + Push", b3_mon()), ("Single-leg power + Pull", b3_wed()),
                             ("Reactive + quad + Arms", b3_fri()), THU_VO2)),
    dict(name="Strength A", start=23, end=26, scheme=(4, 4, 4, 6, 1),
         rep_scheme="Main 4 x 4–6 @ RIR 1–2. Plyos at maintenance.", notes=None,
         sessions=week_shape(("Heavy legs + Push", strength_wave_mon(4, (4, 6))),
                             ("Single-leg power + Pull", strength_wave_wed(4, (4, 6))),
                             ("Change of direction + quad + Arms", strength_wave_fri(4, (4, 6))),
                             THU_VO2, golf=True, b4=True)),
    dict(name="Deload + Test (week 27)", start=27, end=27, scheme=None, sessions_from="Strength A",
         rep_scheme="Strength A at deload volume.", notes="Monthly test Sunday."),
    dict(name="Power B", start=28, end=31, scheme=(3, 3, 3, 3, None),
         rep_scheme="Main 3 x 3 at 75–80% effort, moved fast, each paired with a contrast jump.", notes=None,
         sessions=week_shape(("Contrast legs + Push", power_mon()), ("Contrast single-leg + Pull", power_wed()),
                             ("Speed + quad + Arms", power_fri()), THU_VO2_ALT, golf=True, b4=True)),
    dict(name="Deload + Test (week 32)", start=32, end=32, scheme=None, sessions_from="Power B",
         rep_scheme="Power B at deload volume.", notes="Monthly test Sunday."),
    dict(name="Strength A2", start=33, end=36, scheme=(5, 5, 3, 5, 1),
         rep_scheme="Main 5 x 3–5 @ RIR 1–2. Plyos at maintenance.", notes=None,
         sessions=week_shape(("Heavy legs + Push", strength_wave_mon(5, (3, 5))),
                             ("Single-leg power + Pull", strength_wave_wed(5, (3, 5))),
                             ("Change of direction + quad + Arms", strength_wave_fri(5, (3, 5))),
                             THU_VO2_ALT, golf=True, b4=True)),
    dict(name="Taper + RTS battery", start=37, end=38, scheme=None, sessions_from="Strength A2",
         rep_scheme="Strength A2 at deload volume.",
         notes="Full return-to-sport battery Sunday 5/16 (PT Tracker)."),
    dict(name="Return to Sport + Maintenance", start=39, end=520, scheme=(3, 4, 4, 8, 2),
         activation="gate", gate="rts", fallback="Strength A2",
         rep_scheme="Strength 2–3x a week, main 3–4 x 4–8; injury prevention 2x a week.",
         notes="Starts when the rts gate is on; until then Strength A2 keeps running.",
         sessions={
             (1, 0): lift("Lower heavy + upper push", rts_mon(), "Prevention block after the lifts."),
             (2, 0): ("peloton", "Peloton VO2 max", "vo2_intervals", 40, 45, THU_VO2[5], None, False, None),
             (3, 0): ("run", "Run", None, 20, 60, "Per the triathlon plan once it starts; weekly run minutes up 10% at most.", "jog", False, None),
             (4, 0): lift("Lower single-leg/power + upper pull", rts_thu(), "Prevention block after the lifts."),
             (5, 0): ("peloton", "Peloton Zone 2", "zone2", 45, 60, None, None, False, None),
             (6, 0): lift("Full body", rts_sat(), "Optional third lift.", optional=True),
             (6, 1): ("walk", "Ruck", None, 45, 60, "Ruck at Zone 2 heart rate.", None, True, None),
             (6, 2): GOLF_SHORT,
             (6, 3): GOLF_FULL,
             (0, 0): ("test", "Test day + walk", None, None, None,
                      "PT Tracker tests and a 30 min walk. Quarterly benchmarks: dead hang (target 2 min), "
                      "farmer carry at half bodyweight per hand (target 1 min), 18\" step-down with 3 s control per leg.",
                      None, False, None),
         }),
    dict(name="Triathlon (placeholder)", start=39, end=520, scheme=None, activation="manual",
         rep_scheme=None, notes="Empty placeholder. Turn it on by setting its activation date, then add sessions.",
         sessions={}),
]
DELOAD_WEEKS = {13, 18, 27, 32, 37, 38}
WEEK_NOTES = {
    9: "On-ramp: find loads.",
    12: "Kazaglis visit 11/10: review the barbell, depth_past_90 and jog gates.",
    13: "Deload + test. PT progress note 11/19: review gates. Full test battery Sunday 11/22.",
    18: "Holiday deload. Test Sunday 12/27.",
    22: "Sunday: first hop test battery (single, triple, crossover, 6 m timed) in the PT Tracker.",
    26: "Last week of Strength A.",
    27: "Deload + monthly test Sunday.",
    31: "Last week of Power B.",
    32: "Deload + monthly test Sunday.",
    37: "Taper.",
    38: "Taper. Full return-to-sport battery Sunday 5/16. rts gate eligible 5/17.",
}
GATES = [
    # key, label, earliest_on, old key
    ("barbell", "Barbell squats", None, None),
    ("depth_past_90", "Squat depth past 90°", None, None),
    ("ke_full_range", "Knee extension full range (90→0°)", None, "full_range_knee_extension"),
    ("nordic", "Nordic curls", None, None),
    ("jog", "Jogging (walk-jog)", "2026-10-26", None),
    ("plyo_double", "Plyometrics, two-leg", "2026-11-09", "plyo"),
    ("plyo_single", "Plyometrics, single-leg", None, None),
    ("golf_short", "Golf short game", None, "golf_short_game"),
    ("golf_full", "Golf full swing", None, "golf_full_swing"),
    ("cutting", "Cutting and change of direction", None, None),
    ("rts", "Return to sport", "2027-05-17", "return_to_sport"),
    ("run_20min", "20 min continuous run done", None, None),
]
OLD_GATES = ["full_range_knee_extension", "plyo", "golf_short_game", "golf_full_swing", "return_to_sport"]
SETTINGS = [
    # key, value, text, label, unit, group, sort
    ("hold_step_seconds", 5, None, "Hold increase per step", "s", "Progression", 120),
    ("pull_up_load_at_total_reps", 30, None, "Pull-ups: add load at total reps", "reps", "Progression", 130),
    ("warm_up", None, None, "Lift-day warm-up (8 min)", None, "Program", 10),
    ("program_rules", None, None, "Program rules (one per line)", None, "Program", 20),
]

# ---------------------------------------------------------------- SQL helpers
def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def tup(vals, casts=None):
    out = []
    for i, v in enumerate(vals):
        c = casts[i] if casts else None
        s = q(v)
        if c:
            s = f"{s}::{c}"
        out.append(s)
    return "(" + ", ".join(out) + ")"

OWNER = "with o as (select user_id as uid from public.profiles order by created_at limit 1)"
PROG = f"join public.training_programs p on p.user_id = o.uid and p.name = {q(PROGRAM)}"

# ---------------------------------------------------------------- validate
for b in BLOCKS:
    for key, sess in (b.get("sessions") or {}).items():
        if sess[0] == "walk_jog":
            assert key[0] not in (1, 3, 5)
        if sess[0] == "lift":
            orders = [r["order"] for r in sess[9]]
            assert len(orders) == len(set(orders)), (b["name"], key, orders)
            for r in sess[9]:
                for g in (r["gate"], r["gate2"]):
                    assert g is None or g in {k for k, *_ in GATES}, g

# ---------------------------------------------------------------- SQL build
parts = []
header = f"""-- Program v1 (2026-10-19): the canonical program, replacing the earlier seed
-- (20261019120100). Generated from one definition; idempotent and safe to
-- rerun. Rows are updated in place (matched by block name, weekday + slot,
-- exercise slot); rows v1 no longer uses get deleted_at, never a delete.
-- Logged history (strength sets, rides, check-ins, outcomes) is not touched.
-- Needs 20261019200000_program_v1_schema.sql first.
"""

# 1. gates
gate_vals = ",\n  ".join(tup([k, label, earliest, old], [None, None, "date", None]) for k, label, earliest, old in GATES)
parts.append(("gates", f"""-- 1. Gates: v1 names; renamed gates keep their cleared date.
{OWNER}
insert into public.program_gates (user_id, gate_key, label, earliest_on, cleared_on, notes)
select o.uid, g.gate_key, g.label, coalesce(old.earliest_on, g.earliest_on), old.cleared_on, old.notes
from o
cross join (values
  {gate_vals}
) as g(gate_key, label, earliest_on, old_key)
left join public.program_gates old
  on old.user_id = o.uid and old.gate_key = coalesce(g.old_key, g.gate_key)
on conflict (user_id, gate_key) do update
  set label = excluded.label,
      earliest_on = coalesce(public.program_gates.earliest_on, excluded.earliest_on),
      deleted_at = null;
"""))

# 2. program
parts.append(("program", f"""-- 2. Program: version label and return-to-sport week.
{OWNER}
update public.training_programs p
set version = {q(VERSION)},
    return_to_sport_week = 39,
    notes = 'Left ACL reconstruction (BTB autograft, partial lateral meniscectomy, chondroplasty) on 2026-08-17. Right-handed golfer: the left knee is the lead knee.'
from o
where p.user_id = o.uid and p.name = {q(PROGRAM)};
"""))

# 3-7: blocks, weeks, sessions and exercises. Retire everything in the
# program first, then upsert v1, which clears deleted_at on every row v1
# uses: whatever v1 no longer uses stays retired. One transaction.
CODES = {b["name"]: f"k{i}" for i, b in enumerate(BLOCKS)}


def jdump(obj):
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


block_rows = []
for b in BLOCKS:
    sc = b.get("scheme") or (None,) * 5
    block_rows.append(tup([CODES[b["name"]], b["name"], b["start"], b["end"], *sc, b.get("rep_scheme"),
                           b.get("notes"), b.get("activation", "week"), b.get("gate"),
                           CODES.get(b.get("sessions_from")), CODES.get(b.get("fallback"))],
                          [None, None, "smallint", "smallint", "smallint", "smallint", "smallint", "smallint",
                           "numeric", None, None, None, None, None, None] if not block_rows else None))
week_rows = ", ".join(tup([w, w in DELOAD_WEEKS, WEEK_NOTES.get(w)], ["smallint", None, None] if w == 9 else None)
                      for w in range(9, 39))

sess_json = []
ex_json = []
for b in BLOCKS:
    for (day, sort), s in sorted((b.get("sessions") or {}).items()):
        stype, name, ride, mmin, mmax, structure, gate, optional, notes = s[:9]
        row = {"k": CODES[b["name"]], "d": day, "s": sort, "t": stype, "n": name, "rk": ride,
               "m1": mmin, "m2": mmax, "st": structure, "g": gate, "op": optional or None, "nt": notes}
        sess_json.append({k: v for k, v in row.items() if v is not None})
        if stype != "lift":
            continue
        for r in s[9]:
            row = {"k": CODES[b["name"]], "d": day, "s": sort, "o": r["order"], "n": r["name"],
                   "pt": r["part"], "c": r["cat"], "mu": r["muscle"],
                   "rd": None if r["ready"] == "any" else r["ready"],
                   "ms": None if r["measure"] == "reps" else r["measure"],
                   "sd": None if r["side"] == "bilateral" else r["side"],
                   "l": None if r["load"] == "bodyweight" else r["load"],
                   "s1": r["smin"], "s2": r["smax"], "r1": r["rmin"], "r2": r["rmax"], "ir": r["rir"],
                   "sc": r["secs"], "dm": r["dist"], "tp": r["tempo"], "g": r["gate"], "g2": r["gate2"],
                   "sb": r["sub"], "sl": r["sub_load"], "sr1": r["srmin"], "sr2": r["srmax"],
                   "fw": r["fw"], "uw": r["uw"], "q": r["quad"] or None, "nt": r["notes"]}
            ex_json.append({k: v for k, v in row.items() if v is not None})
ex_count = {}
for b in BLOCKS:
    ex_count[b["name"]] = sum(1 for e in ex_json if e["k"] == CODES[b["name"]])
used = sorted({e["n"] for e in ex_json})
cue_json = jdump({n: CUES[n] for n in used})
for blob in (jdump(sess_json), jdump(ex_json), cue_json):
    assert "$j$" not in blob

parts.append(("program rows", f"""-- 3. Retire the program's blocks, sessions and exercises; the upserts below
-- bring back every row v1 uses (the Block 4 placeholder and the old gated
-- slots stay retired).
{OWNER}
update public.program_exercises e set deleted_at = now()
from o {PROG}
join public.program_blocks b on b.program_id = p.id
join public.program_sessions s on s.block_id = b.id
where e.program_session_id = s.id and e.deleted_at is null;

{OWNER}
update public.program_sessions s set deleted_at = now()
from o {PROG}
join public.program_blocks b on b.program_id = p.id
where s.block_id = b.id and s.deleted_at is null;

{OWNER}
update public.program_blocks b set deleted_at = now()
from o {PROG}
where b.program_id = p.id and b.deleted_at is null;

-- 4. Blocks (k = block code within this script).
drop table if exists pg_temp.v1_blocks;
create temporary table v1_blocks (
  k text, name text, start_week smallint, end_week smallint, sets_min smallint, sets_max smallint,
  reps_min smallint, reps_max smallint, rir_target numeric, rep_scheme text, notes text,
  activation text, gate_key text, from_k text, fallback_k text
);
insert into v1_blocks values
  {(","+chr(10)+"  ").join(block_rows)};

{OWNER}
insert into public.program_blocks
  (user_id, program_id, name, start_week, end_week, sets_min, sets_max, reps_min, reps_max,
   rir_target, rep_scheme, notes, activation, gate_key)
select o.uid, p.id, v.name, v.start_week, v.end_week, v.sets_min, v.sets_max, v.reps_min, v.reps_max,
  v.rir_target, v.rep_scheme, v.notes, v.activation, v.gate_key
from o {PROG}
cross join v1_blocks v
on conflict (program_id, name) do update
  set start_week = excluded.start_week, end_week = excluded.end_week,
      sets_min = excluded.sets_min, sets_max = excluded.sets_max,
      reps_min = excluded.reps_min, reps_max = excluded.reps_max,
      rir_target = excluded.rir_target, rep_scheme = excluded.rep_scheme, notes = excluded.notes,
      activation = excluded.activation, gate_key = excluded.gate_key,
      sessions_from_block_id = null, fallback_block_id = null, deleted_at = null;

{OWNER}
update public.program_blocks b
set sessions_from_block_id = src.id
from o {PROG}
join v1_blocks v on v.from_k is not null
join v1_blocks vs on vs.k = v.from_k
join public.program_blocks src on src.program_id = p.id and src.name = vs.name
where b.program_id = p.id and b.name = v.name;

{OWNER}
update public.program_blocks b
set fallback_block_id = fb.id
from o {PROG}
join v1_blocks v on v.fallback_k is not null
join v1_blocks vf on vf.k = v.fallback_k
join public.program_blocks fb on fb.program_id = p.id and fb.name = vf.name
where b.program_id = p.id and b.name = v.name;

-- 5. Weeks 9-38: deloads in 13, 18, 27, 32 and the 37-38 taper.
{OWNER}
insert into public.program_weeks (user_id, program_id, week_number, is_deload, notes)
select o.uid, p.id, v.week_number, v.is_deload, v.notes
from o {PROG}
cross join (values {week_rows}) as v(week_number, is_deload, notes)
on conflict (program_id, week_number) do update
  set is_deload = excluded.is_deload, notes = excluded.notes, deleted_at = null;

-- 6. Sessions: the same weekday slots in every block.
{OWNER}
insert into public.program_sessions
  (user_id, block_id, day_of_week, sort_order, session_type, name, ride_kind,
   minutes_min, minutes_max, structure, gate_key, is_optional, notes)
select o.uid, b.id, v.d, v.s, v.t, v.n, v.rk, v.m1, v.m2, v.st, v.g, coalesce(v.op, false), v.nt
from o {PROG}
cross join jsonb_to_recordset($j${jdump(sess_json)}$j$::jsonb)
  as v(k text, d smallint, s smallint, t text, n text, rk text, m1 smallint, m2 smallint,
       st text, g text, op boolean, nt text)
join v1_blocks vb on vb.k = v.k
join public.program_blocks b on b.program_id = p.id and b.name = vb.name
on conflict (block_id, day_of_week, sort_order) do update
  set session_type = excluded.session_type, name = excluded.name, ride_kind = excluded.ride_kind,
      minutes_min = excluded.minutes_min, minutes_max = excluded.minutes_max,
      structure = excluded.structure, gate_key = excluded.gate_key,
      is_optional = excluded.is_optional, notes = excluded.notes,
      upper_template_id = null, deleted_at = null;

-- 7. Exercises. Defaults when a key is missing: readiness any, measure reps,
-- bilateral, bodyweight, not a quad set. Cues come from the library below.
{OWNER}
insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, category, primary_muscle,
   readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max,
   rir_target, seconds_target, distance_meters_target, tempo, gate_key, extra_gate_key,
   substitute_name, substitute_load_kind, substitute_reps_min, substitute_reps_max,
   from_week, until_week, counts_as_quad_set, cue, notes)
select o.uid, s.id, v.o, v.n, v.pt, v.c, v.mu,
  coalesce(v.rd, 'any'), coalesce(v.ms, 'reps'), coalesce(v.sd, 'bilateral'), coalesce(v.l, 'bodyweight'),
  v.s1, v.s2, v.r1, v.r2, v.ir, v.sc, v.dm, v.tp, v.g, v.g2, v.sb, v.sl, v.sr1, v.sr2,
  v.fw, v.uw, coalesce(v.q, false), cues.c ->> v.n, v.nt
from o {PROG}
cross join (select $j${cue_json}$j$::jsonb as c) as cues
cross join jsonb_to_recordset($j${jdump(ex_json)}$j$::jsonb)
  as v(k text, d smallint, s smallint, o smallint, n text, pt text, c text, mu text, rd text,
       ms text, sd text, l text, s1 smallint, s2 smallint, r1 smallint, r2 smallint, ir numeric,
       sc smallint, dm smallint, tp text, g text, g2 text, sb text, sl text, sr1 smallint,
       sr2 smallint, fw smallint, uw smallint, q boolean, nt text)
join v1_blocks vb on vb.k = v.k
join public.program_blocks b on b.program_id = p.id and b.name = vb.name
join public.program_sessions s on s.block_id = b.id and s.day_of_week = v.d and s.sort_order = v.s
on conflict (program_session_id, exercise_order) do update
  set exercise_name = excluded.exercise_name, block_part = excluded.block_part,
      category = excluded.category, primary_muscle = excluded.primary_muscle,
      readiness_requirement = excluded.readiness_requirement, measure = excluded.measure,
      side_mode = excluded.side_mode, load_kind = excluded.load_kind,
      sets_min = excluded.sets_min, sets_max = excluded.sets_max,
      reps_min = excluded.reps_min, reps_max = excluded.reps_max, rir_target = excluded.rir_target,
      seconds_target = excluded.seconds_target, distance_meters_target = excluded.distance_meters_target,
      tempo = excluded.tempo, gate_key = excluded.gate_key, extra_gate_key = excluded.extra_gate_key,
      substitute_name = excluded.substitute_name, substitute_load_kind = excluded.substitute_load_kind,
      substitute_reps_min = excluded.substitute_reps_min, substitute_reps_max = excluded.substitute_reps_max,
      from_week = excluded.from_week, until_week = excluded.until_week,
      counts_as_quad_set = excluded.counts_as_quad_set, cue = excluded.cue, notes = excluded.notes,
      deleted_at = null;

drop table pg_temp.v1_blocks;

-- Old gate names, now that nothing live points at them.
{OWNER}
update public.program_gates g
set deleted_at = now()
from o
where g.user_id = o.uid and g.deleted_at is null
  and g.gate_key in ({", ".join(q(k) for k in OLD_GATES)});
"""))

# 8. settings, habit, templates
WARM_UP = "Peloton easy 5 min; band TKE 15/leg; box squat bodyweight x10; glute bridge x10; leg swings 10/side"
RULES = "\n".join([
    "Order: readiness check, warm-up, power/plyo, main leg lift, leg accessories, upper body, core/finisher.",
    "Main lifts never to failure. Accessories may go to RIR 1.",
    "Double progression: every set at the top of the range at the target RIR or better, then +5 lb barbell / next DB / +2.5 lb cuff / +5 s holds. Otherwise repeat.",
    "Per-leg lifts: left first; its reps set the target; the right matches at the same load. Progress off the left only.",
    "No load increase unless the knee check is normal, outside deloads, and 3-night sleep is 6.5 h or more.",
    "Deload: one set off everything, no load increases, plyo volume halved.",
    "Hard quad sets: 12-16 a week.",
    "Zone 2: 150 min a week (rides and walks at Zone 2 heart rate). 8,000 steps and the 5-min ROM check daily.",
    "Pull-ups: at 30 total reps across sets, add load (belt or DB between the feet).",
    "No conventional deadlifts. No kneeling on the left knee (half-kneel on the right only).",
    "Pull-ups: step down onto the bench with the right leg, never drop off the bar, until the plyo gate is cleared.",
])
setting_rows = []
for key, val, _t, label, unit, group, sort in SETTINGS:
    text = WARM_UP if key == "warm_up" else RULES if key == "program_rules" else None
    setting_rows.append(tup([key, val, text, label, unit, group, sort],
                            [None, "numeric", None, None, None, None, "smallint"]))


def template_def(day_rows, title):
    exercises = []
    for r in sorted(day_rows, key=lambda r: r["order"]):
        if r["fw"] is not None and r["fw"] > 10:
            continue  # starts after Block 1's first week (RFESS from week 11 noted on the split squat)
        name = r["sub"] if r["gate"] else r["name"]
        reps = None if r["measure"] != "reps" else (r["srmax"] if r["gate"] and r["srmax"] else r["rmax"])
        bits = []
        if r["gate"]:
            bits.append(f"Until the {r['gate']} gate; then {r['name']}.")
        if r["measure"] == "time":
            bits.append(f"{r['secs']} s" + (" per side." if r["side"] == PER_SIDE else " per leg." if r["side"] == PER_LEG else "."))
        if r["measure"] == "force":
            bits.append(f"{r['secs']} s max, log peak N, per leg.")
        if r["measure"] == "distance":
            bits.append(f"{r['dist']} m per side.")
        if r["measure"] == "reps" and r["rmin"] != r["rmax"] and not r["gate"]:
            bits.append(f"{r['rmin']}-{r['rmax']} reps.")
        if r["side"] == PER_LEG and r["measure"] == "reps":
            bits.append("Per leg, left first.")
        if r["side"] == PER_SIDE and r["measure"] == "reps":
            bits.append("Per side.")
        if r["name"] == "Split Squat (to 90°)":
            bits.append("From week 11: rear foot elevated.")
        if r["ready"] == "normal":
            bits.append("Normal knee check only.")
        bits.append(r["cue"])
        exercises.append({
            "exerciseName": name,
            "exerciseOrder": len(exercises) + 1,
            "targetSets": r["smax"],
            "targetReps": reps,
            "targetWeight": None,
            "targetRir": int(r["rir"]) if r["rir"] is not None else None,
            "notes": " ".join(bits),
        })
    notes = (f"{VERSION}, Block 1 (weeks 10-12). The program card on /strength is the source of truth "
             "(knee check, gates, loads); use this list when that card is not showing. "
             f"Warm-up 8 min: {WARM_UP}. Legs first, then upper, then core. Left leg first on per-leg work. "
             "No kneeling on the left knee; on and off benches leading with the right leg.")
    return {"notes": notes, "exercises": exercises}


tmpl_rows = []
for day, (title, rows) in zip((1, 3, 5), B1):
    prefix = {1: "Mon", 3: "Wed", 5: "Fri"}[day]
    tmpl_rows.append(tup([day, f"{prefix} {title}", json.dumps(template_def(rows, title), ensure_ascii=False)],
                         ["smallint", None, "jsonb"]))

parts.append(("settings, habit, templates", f"""-- 8. Settings (new keys only; edits made in Settings are kept), the steps
-- habit (8,000), and the three lift templates rebuilt from Block 1.
{OWNER}
insert into public.training_settings (user_id, key, value, text_value, label, unit, group_name, sort_order)
select o.uid, v.key, v.value, v.text_value, v.label, v.unit, v.group_name, v.sort_order
from o
cross join (values
  {(","+chr(10)+"  ").join(setting_rows)}
) as v(key, value, text_value, label, unit, group_name, sort_order)
on conflict (user_id, key) do nothing;

{OWNER}
update public.supplements s
set name = '8,000 steps'
from o
where s.user_id = o.uid and s.kind = 'habit' and s.name = '7,000 steps' and s.deleted_at is null;

{OWNER}
update public.training_templates t
set name = v.name, definition = v.definition
from o
cross join (values
  {(","+chr(10)+"  ").join(tmpl_rows)}
) as v(day, name, definition)
where t.user_id = o.uid and t.template_type = 'strength' and t.deleted_at is null
  and t.scheduled_day_of_week = v.day;
"""))

n_sessions_total = sum(len(b.get("sessions") or {}) for b in BLOCKS)
n_ex_total = len(ex_json)
parts.append(("checks", f"""-- 9. Checks: any mismatch raises, and the whole seed rolls back.
do $$
declare
  pid uuid;
  n int;
begin
  select p.id into pid from public.training_programs p
  join public.profiles pr on pr.user_id = p.user_id
  where p.name = {q(PROGRAM)} order by pr.created_at limit 1;
  select count(*) into n from public.program_blocks where program_id = pid and deleted_at is null;
  if n <> {len(BLOCKS)} then raise exception 'v1 seed: % blocks, expected {len(BLOCKS)}', n; end if;
  select count(*) into n from public.program_sessions s join public.program_blocks b on b.id = s.block_id
    where b.program_id = pid and s.deleted_at is null and b.deleted_at is null;
  if n <> {n_sessions_total} then raise exception 'v1 seed: % sessions, expected {n_sessions_total}', n; end if;
  select count(*) into n from public.program_exercises e join public.program_sessions s on s.id = e.program_session_id
    join public.program_blocks b on b.id = s.block_id
    where b.program_id = pid and e.deleted_at is null and s.deleted_at is null and b.deleted_at is null;
  if n <> {n_ex_total} then raise exception 'v1 seed: % exercises, expected {n_ex_total}', n; end if;
  select count(*) into n from public.program_weeks where program_id = pid and deleted_at is null
    and is_deload and week_number in (13, 18, 27, 32);
  if n <> 4 then raise exception 'v1 seed: % of the 4 deload weeks flagged', n; end if;
end $$;
"""))
sql = header + "\n" + "\n".join(p for _, p in parts)
OUT_MIGRATION.write_text(sql)
OUT_CHUNKS.mkdir(parents=True, exist_ok=True)
for i, (label, p) in enumerate(parts):
    (OUT_CHUNKS / f"{i:02d}.sql").write_text(p)

# ---------------------------------------------------------------- summary
n_sessions = sum(len(b.get("sessions") or {}) for b in BLOCKS)
n_ex = sum(ex_count.values())
names = set()
quad_names = set()
for b in BLOCKS:
    for s in (b.get("sessions") or {}).values():
        if s[0] == "lift":
            for r in s[9]:
                names.add(r["name"])
                if r["sub"]:
                    names.add(r["sub"])
                if r["quad"]:
                    quad_names.add(r["name"])
print(f"blocks {len(BLOCKS)}  weeks 30 (deload {sorted(DELOAD_WEEKS)})  sessions {n_sessions}  exercises {n_ex}  gates {len(GATES)}  settings +{len(SETTINGS)}")
for b in BLOCKS:
    print(f"  {b['name']:<32} wk {b['start']:>2}-{b['end']:<3} sessions {len(b.get('sessions') or {}):>2}  exercises {ex_count.get(b['name'], 0):>3}"
          + (f"  (runs {b['sessions_from']})" if b.get("sessions_from") else ""))
print(f"distinct exercise names (incl. fallbacks): {len(names)}")
print("chunks:", [(i, l, len(p)) for i, (l, p) in enumerate(parts)])
print("sql bytes:", len(sql))

# quad sets per week for the main blocks (non-deload, gates closed -> fallback counts the same)
for b in BLOCKS:
    sess = b.get("sessions") or {}
    total = 0
    for s in sess.values():
        if s[0] == "lift" and not s[7]:
            for r in s[9]:
                if r["quad"] and r["measure"] == "reps" and (r["uw"] is None or r["uw"] >= b["start"] + 1) and (r["fw"] is None or r["fw"] <= b["start"] + 1):
                    total += r["smax"]
    if sess:
        print(f"  quad sets/wk {b['name']}: {total}")
