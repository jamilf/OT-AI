/* ============================================================
   aptitude-data.js — authored items for the aptitude mode.

   TRUTHFULNESS RULE (do not break):
   - Reading passages are ORIGINAL and neutral; every question is
     answerable from its own passage, and each `explain` is grounded
     in that passage (not outside facts).
   - Safety questions are verified and traced to the same material
     already published on this site (see study-data.js safe-* cards)
     or to the named standard/regulation in `source`.
   Do NOT add items whose answer can't be grounded this way without
   checking with the user first.

   Item shapes:
     reading: { id, level, title, passage, questions:[{ q, options[], answer, explain }] }
     safety : { id, level, q, options[], answer, explain, source }
   `answer` is the index of the correct option. Options are unique;
   exactly one is correct.
   ============================================================ */

var APT_READING = [

  { id: "rd-loto", level: 2,
    title: "Personal danger locks",
    passage: "On a worksite, equipment is isolated before anyone works on it. Each worker fits their own personal danger lock to the isolation point and keeps the only key. A danger tag is hung beside the lock to say who fitted it and why. The lock is what holds the isolation; the tag on its own only carries a warning. A personal lock is removed only by the worker who fitted it, once their work is finished.",
    questions: [
      { q: "According to the passage, who may remove a personal danger lock?",
        options: ["Only the worker who fitted it", "Any supervisor on site", "The first worker to finish", "Anyone holding a master key"],
        answer: 0,
        explain: "The passage states a personal lock is removed only by the worker who fitted it." },
      { q: "What does the passage say actually holds the isolation?",
        options: ["The lock", "The tag", "The supervisor's sign-off", "The switch position"],
        answer: 0,
        explain: "It says the lock holds the isolation; the tag on its own only carries a warning." }
    ] },

  { id: "rd-ppe", level: 1,
    title: "Checking PPE",
    passage: "Before each job, a worker checks their personal protective equipment. Safety glasses must be free of deep scratches that block clear vision. Gloves are checked for tears or worn patches. A hard hat is replaced if it has taken a heavy knock, even when no crack is visible, because the shell may no longer absorb an impact. PPE that fails a check is taken out of use, not worn 'just for this one job'.",
    questions: [
      { q: "Why does the passage say a hard hat is replaced after a heavy knock with no visible crack?",
        options: ["The shell may no longer absorb an impact", "It will look damaged to a supervisor", "The colour fades after an impact", "It becomes too heavy to wear"],
        answer: 0,
        explain: "The passage says it is replaced because the shell may no longer absorb an impact, even without a visible crack." },
      { q: "What happens to PPE that fails a check?",
        options: ["It is taken out of use", "It is worn for one more job", "It is cleaned and reused", "It is given to an apprentice"],
        answer: 0,
        explain: "The passage says failed PPE is taken out of use, not worn 'just for this one job'." }
    ] },

  { id: "rd-prove", level: 3,
    title: "Prove, test, prove",
    passage: "After isolating a circuit, a worker confirms it is dead before touching it. First the tester is checked on a known live source to show it works. Then the isolated circuit is tested and should read dead. Finally the tester is checked on the known live source again, to confirm it did not fail between the first check and the test. Only after this prove-test-prove sequence is the circuit treated as safe to work on.",
    questions: [
      { q: "Why is the tester checked on a live source again at the end?",
        options: ["To confirm it didn't fail during the test", "To recharge the tester", "Because the circuit may have re-energised", "To record a second reading"],
        answer: 0,
        explain: "The passage says the final check confirms the tester did not fail between the first check and the test." },
      { q: "When is the circuit treated as safe to work on?",
        options: ["Only after the full prove-test-prove sequence", "As soon as it is isolated", "After the first tester check", "Once a tag is fitted"],
        answer: 0,
        explain: "The passage says the circuit is treated as safe only after the prove-test-prove sequence." }
    ] },

  { id: "rd-permit", level: 4,
    title: "A work permit",
    passage: "Some tasks need a written permit before they start. The permit lists the work, the hazards, and the controls that must be in place. It is signed by the person in charge of the area and by the worker doing the task. Work may not begin until both signatures are present. When the task is finished, the permit is handed back and closed, which signals that the area can return to normal operation.",
    questions: [
      { q: "When may work under the permit begin?",
        options: ["Once both required signatures are present", "As soon as the worker arrives", "After the hazards are listed", "When the area is quiet"],
        answer: 0,
        explain: "The passage says work may not begin until both signatures are present." },
      { q: "What does handing back and closing the permit signal?",
        options: ["The area can return to normal operation", "A new permit is needed", "The worker is taking a break", "The hazards have increased"],
        answer: 0,
        explain: "The passage says closing the permit signals the area can return to normal operation." }
    ] },

  { id: "rd-rate", level: 3,
    title: "Reading a meter log",
    passage: "A technician logs a tank level every hour. At 9 am it reads 80 litres; at 10 am, 68 litres; at 11 am, 56 litres. The level falls by the same amount each hour while a pump runs. The technician notes that if the trend continues, the tank will need refilling before it reaches the 20-litre minimum.",
    questions: [
      { q: "By how many litres does the level fall each hour?",
        options: ["12 litres", "10 litres", "14 litres", "8 litres"],
        answer: 0,
        explain: "80 to 68 is 12 litres, and 68 to 56 is 12 litres, so the level falls 12 litres each hour." },
      { q: "If the trend continues, what reading is expected at 12 pm?",
        options: ["44 litres", "48 litres", "40 litres", "56 litres"],
        answer: 0,
        explain: "56 litres minus the 12-litre hourly fall gives 44 litres at 12 pm." }
    ] },

  { id: "rd-reel", level: 2,
    title: "Cable reels",
    passage: "A cable reel is rolled in the direction the cable is wound, so the cable stays tight on the drum. Reels are stored on their edge, never flat, to stop the flanges bending. A reel heavier than 25 kg is moved with a trolley or by two people.",
    questions: [
      { q: "How should a reel be rolled?", options: ["In the direction the cable is wound", "Backwards against the winding", "Only downhill", "On its flat side"], answer: 0, explain: "Rolling with the winding keeps the cable tight on the drum." },
      { q: "How are reels stored?", options: ["On their edge", "Flat on the ground", "Hung from a hook", "Stacked three high"], answer: 0, explain: "They are stored on edge so the flanges don't bend." }
    ] },

  { id: "rd-ladder", level: 2,
    title: "Ladder set-up",
    passage: "A straight ladder is set at about a 4-to-1 angle: one unit out from the base for every four units of height. It must be footed or tied so it can't slip, and it should extend about a metre above the landing it serves. Metal ladders are not used near live electrical work.",
    questions: [
      { q: "What angle should the ladder be set at?", options: ["About 4 up to 1 out", "About 1 up to 1 out", "About 2 up to 3 out", "Flat as possible"], answer: 0, explain: "The passage gives a 4-to-1 ratio: four up for one out." },
      { q: "Why avoid a metal ladder near live electrical work?", options: ["Metal conducts electricity", "It is too heavy", "It rusts", "It is too tall"], answer: 0, explain: "Implied by the rule against metal ladders near live work: metal conducts." }
    ] },

  { id: "rd-waste", level: 3,
    title: "Site waste",
    passage: "Offcuts of copper and aluminium go in the labelled metals bin for recycling. Cable offcuts with insulation still on go in general waste unless the insulation is stripped first. Batteries are never put in any of the bins; they go to the marked battery box.",
    questions: [
      { q: "Where do clean copper offcuts go?", options: ["The metals recycling bin", "General waste", "The battery box", "Down the drain"], answer: 0, explain: "Clean copper goes in the labelled metals bin." },
      { q: "Where do used batteries go?", options: ["The marked battery box", "The metals bin", "General waste", "Any bin"], answer: 0, explain: "Batteries go to the marked battery box, never the bins." }
    ] },

  { id: "rd-deliv", level: 3,
    title: "Receiving a delivery",
    passage: "When a delivery arrives, the storeperson counts it against the docket before signing. Damaged cartons are photographed and noted on the docket. Anything not on the docket is set aside and the supplier is phoned, not put into stock.",
    questions: [
      { q: "What is done before signing for a delivery?", options: ["It is counted against the docket", "It is put straight into stock", "It is photographed in full", "Nothing"], answer: 0, explain: "The storeperson counts it against the docket before signing." },
      { q: "What happens to an item not listed on the docket?", options: ["It is set aside and the supplier phoned", "It is added to stock anyway", "It is thrown out", "It is signed for"], answer: 0, explain: "Unlisted items are set aside and the supplier is called, not stocked." }
    ] },

  { id: "rd-signoff", level: 4,
    title: "Job sign-off",
    passage: "A job is signed off only after it is tested and the area is left clean. The apprentice records the test results; the supervisor checks them and signs. If a result is outside the allowed range, the job is not signed off and is booked for rework.",
    questions: [
      { q: "Who signs off the job?", options: ["The supervisor, after checking the results", "The apprentice alone", "The client", "Whoever is free"], answer: 0, explain: "The apprentice records results; the supervisor checks and signs." },
      { q: "What happens if a test result is out of range?", options: ["The job is booked for rework, not signed off", "It is signed off anyway", "The result is ignored", "The area is cleaned and closed"], answer: 0, explain: "Out-of-range results mean no sign-off and rework." }
    ] }

];

var APT_SAFETY = [

  { id: "sf-elv", level: 1,
    q: "In NSW, the upper limit for extra-low voltage (ELV) AC is:",
    options: ["50 V AC", "120 V AC", "230 V AC", "1000 V AC"],
    answer: 0,
    explain: "Extra-low voltage is at or below 50 V AC / 120 V DC.",
    source: "Gas and Electricity (Consumer Safety) Act 2017 · feeder-monitor.html, Legal envelope" },

  { id: "sf-tag", level: 2,
    q: "Which statement is correct about a danger tag?",
    options: ["A tag is a warning; the lock provides the isolation", "A tag isolates the supply on its own", "A tag may be removed by anyone", "A tag replaces the need to test dead"],
    answer: 0,
    explain: "A tag is not an isolation device; the lock is. The tag carries a warning.",
    source: "feeder-monitor.html, Safety first" },

  { id: "sf-prove", level: 2,
    q: "What is the correct order to confirm a circuit is dead?",
    options: ["Prove the tester live, test the circuit dead, prove the tester live again", "Test the circuit, then isolate it", "Test dead once and start work", "Prove the tester, then fit a tag"],
    answer: 0,
    explain: "Prove, test, prove: check the tester on a known live source, test the circuit dead, then re-check the tester.",
    source: "feeder-monitor.html, Safety first" },

  { id: "sf-isolate", level: 3,
    q: "Why is a functional on/off switch not treated as an isolation point?",
    options: ["It isn't designed or rated as an energy-isolating device", "It is too far from the work", "It cannot be turned off", "It has no label"],
    answer: 0,
    explain: "You isolate at the proper isolating device and lock it off; a functional switch isn't rated for isolation.",
    source: "feeder-monitor.html, Safety first" },

  { id: "sf-code", level: 3,
    q: "Which document sets out how to manage electrical risks at work in NSW?",
    options: ["The SafeWork NSW 'Managing electrical risks in the workplace' Code of Practice", "The Building Code of Australia", "The road rules", "The supplier's catalogue"],
    answer: 0,
    explain: "Managing electrical risks at work in NSW sits under that Code of Practice and WHS Regulation Part 4.7.",
    source: "feeder-monitor.html, Safety first" },

  { id: "sf-firstaid", level: 1,
    q: "If you find a workmate in contact with a live electrical source, what is the first priority?",
    options: ["Make the area safe by isolating the supply before touching them", "Pull them away with your bare hands", "Pour water on the source", "Wait for the shift to end"],
    answer: 0,
    explain: "Don't become a second casualty: isolate or remove the supply before making contact, then call for help.",
    source: "General electrical safety practice · SafeWork NSW guidance" },

  { id: "sf-earth", level: 4,
    q: "What is the main purpose of earthing in an installation?",
    options: ["To give fault current a return path so protection operates", "To make wiring cheaper", "To raise the supply voltage", "To stop the meter spinning"],
    answer: 0,
    explain: "Earthing provides a low-impedance return path so a protective device carries enough current to trip in time.",
    source: "feeder-monitor.html, Protection & earthing" },

  { id: "sf-whitecard", level: 1,
    q: "What does a White Card show?",
    options: ["The holder has completed general construction induction training", "The holder is a licensed electrician", "The holder owns the site", "The holder can skip site inductions"],
    answer: 0,
    explain: "A White Card evidences general construction induction training; it is not a trade licence.",
    source: "SafeWork NSW general construction induction" }

];

/* Verbal reasoning: read the passage, judge each statement.
   answer index into ["True","False","Cannot say"]: 0 = True, 1 = False, 2 = Cannot say.
   True = stated/entailed; False = contradicted; Cannot say = not determinable. */
var APT_VERBAL = [

  { id: "vb-access", level: 2, title: "Site access",
    passage: "All visitors to the site must sign in at the gate and complete a safety induction before entering. Contractors who completed the induction within the past twelve months do not need to repeat it. High-visibility clothing is required beyond the gate.",
    statements: [
      { s: "A first-time visitor must complete a safety induction before entering.", answer: 0, explain: "All visitors must induct before entering, and a first-timer has not done so." },
      { s: "A contractor inducted six months ago must induct again today.", answer: 1, explain: "Those inducted within the past twelve months do not need to repeat it." },
      { s: "High-visibility clothing is required at the sign-in gate itself.", answer: 2, explain: "Hi-vis is required beyond the gate; the passage doesn't say what applies at the gate itself." }
    ] },

  { id: "vb-tools", level: 2, title: "Tool store",
    passage: "Power tools are signed out from the store each morning and returned by 4 pm. Any damaged tool must be tagged out and reported. The store keeps two cordless drills and one rotary hammer.",
    statements: [
      { s: "The store has more cordless drills than rotary hammers.", answer: 0, explain: "Two cordless drills versus one rotary hammer." },
      { s: "A tool with a frayed cord may simply be put back on the shelf.", answer: 1, explain: "Damaged tools must be tagged out and reported, not returned to use." },
      { s: "The store opens at 7 am.", answer: 2, explain: "The opening time is not stated." }
    ] },

  { id: "vb-roster", level: 3, title: "Crew roster",
    passage: "The crew works Monday to Friday. Saturday work is occasionally offered and is voluntary. Public holidays are not worked.",
    statements: [
      { s: "Crew members can be required to work on Saturdays.", answer: 1, explain: "Saturday work is voluntary, so it cannot be required." },
      { s: "Saturday work is sometimes available.", answer: 0, explain: "It is occasionally offered." },
      { s: "The crew starts at 6:30 am on weekdays.", answer: 2, explain: "Start times are not stated." }
    ] },

  { id: "vb-delivery", level: 3, title: "Deliveries",
    passage: "Cable drums are delivered on Tuesdays. Each delivery is checked against the order before the driver leaves. Short deliveries are recorded and the supplier is notified the same day.",
    statements: [
      { s: "Deliveries are checked before the driver departs.", answer: 0, explain: "The passage says each delivery is checked before the driver leaves." },
      { s: "If items are missing, the supplier is told the following week.", answer: 1, explain: "Short deliveries are notified the same day." },
      { s: "Conduit is delivered on Tuesdays.", answer: 2, explain: "Only cable drums are mentioned; conduit is not stated." }
    ] },

  { id: "vb-weather", level: 4, title: "Weather and work",
    passage: "Work at height stops when wind gusts exceed the site limit. In heavy rain, outdoor electrical work is paused. Indoor work continues in wet weather.",
    statements: [
      { s: "Outdoor electrical work continues during heavy rain.", answer: 1, explain: "Outdoor electrical work is paused in heavy rain." },
      { s: "Indoor work can continue when it is raining.", answer: 0, explain: "Indoor work continues in wet weather." },
      { s: "Work at height stops in a light drizzle.", answer: 2, explain: "Height work stops on wind gusts over the limit; drizzle alone isn't addressed." }
    ] },

  { id: "vb-stock", level: 2, title: "Stocktake",
    passage: "The store is counted on the last Friday of each month. Items below their minimum level are reordered the same day. Slow-moving items are reviewed but not automatically removed.",
    statements: [
      { s: "The store is counted every month.", answer: 0, explain: "It is counted on the last Friday of each month." },
      { s: "Items below minimum are reordered the next month.", answer: 1, explain: "They are reordered the same day, not the next month." },
      { s: "Slow-moving items are thrown out automatically.", answer: 1, explain: "They are reviewed, not automatically removed." }
    ] },

  { id: "vb-labels", level: 3, title: "Switchboard labels",
    passage: "Every circuit on the board must have a label. Labels are printed, not handwritten. A circuit without a label is tagged out until one is fitted.",
    statements: [
      { s: "Handwritten labels are acceptable.", answer: 1, explain: "Labels must be printed, not handwritten." },
      { s: "An unlabelled circuit is tagged out until labelled.", answer: 0, explain: "Stated directly." },
      { s: "The board has exactly twelve circuits.", answer: 2, explain: "The number of circuits is not given." }
    ] },

  { id: "vb-toolbox", level: 2, title: "Toolbox talk",
    passage: "A toolbox talk is held each morning before work starts. Attendance is recorded. Anyone arriving after it has finished must read the notes and sign before going on the tools.",
    statements: [
      { s: "The toolbox talk happens before work starts.", answer: 0, explain: "It is held each morning before work." },
      { s: "Latecomers can skip the talk entirely.", answer: 1, explain: "They must read the notes and sign first." },
      { s: "The talk always lasts ten minutes.", answer: 2, explain: "The duration is not stated." }
    ] },

  { id: "vb-vehicle", level: 3, title: "Vehicle checks",
    passage: "Work vehicles are checked at the start of each shift: lights, tyres and fluid levels. A fault that affects safety takes the vehicle off the road until fixed. Minor faults are logged and booked in.",
    statements: [
      { s: "Vehicles are checked once a week.", answer: 1, explain: "They are checked at the start of each shift." },
      { s: "A safety fault stops the vehicle being used.", answer: 0, explain: "It is taken off the road until fixed." },
      { s: "The check includes the radio.", answer: 2, explain: "Only lights, tyres and fluids are listed." }
    ] },

  { id: "vb-permit", level: 4, title: "Permit board",
    passage: "An open permit hangs on the permit board with the worker's name. The board shows at a glance which areas are under a permit. A permit is removed only when the work is finished and the area handed back.",
    statements: [
      { s: "You can tell from the board which areas are under a permit.", answer: 0, explain: "The board shows this at a glance." },
      { s: "A permit may be removed before the work is finished.", answer: 1, explain: "It is removed only once work is finished and handed back." },
      { s: "There are three permits open right now.", answer: 2, explain: "The current count is not given." }
    ] },

  { id: "vb-training", level: 3, title: "Training records",
    passage: "Tickets and competencies are kept in each worker's training record. A ticket within three months of expiry is flagged for renewal. Work needing a current ticket is not allocated to anyone whose ticket has lapsed.",
    statements: [
      { s: "An expired ticket can still be used for ticketed work.", answer: 1, explain: "Lapsed-ticket holders aren't allocated that work." },
      { s: "Tickets near expiry are flagged for renewal.", answer: 0, explain: "Flagged within three months of expiry." },
      { s: "First aid tickets last three years.", answer: 2, explain: "No ticket duration is stated." }
    ] }

];
