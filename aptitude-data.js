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
