// server/zapDemoScript.ts
// Hardcoded ZAP demo video script - DO NOT MODIFY
// This script is locked and does not go through AI generation

export const ZAP_DEMO_SCRIPT = {
  scenes: [
    {
      sceneNumber: 1,
      duration: 3,
      voiceoverText: "You've tried running Facebook ads before. You spent the money. You got nothing back.",
      onScreenText: "YOU'VE TRIED THIS BEFORE.",
      visualDirection: "person frustrated looking at laptop screen results",
      pexelsQuery: "person frustrated looking at laptop screen results"
    },
    {
      sceneNumber: 2,
      duration: 4,
      voiceoverText: "It wasn't your fault. You had the wrong tool. Built for businesses — not coaches.",
      onScreenText: "WRONG TOOL. WRONG RESULTS.",
      visualDirection: "business person confused overwhelmed paperwork stress",
      pexelsQuery: "business person confused overwhelmed paperwork stress"
    },
    {
      sceneNumber: 3,
      duration: 5,
      voiceoverText: "ZAP was built by a coach who's worked with 900,000 people across 49 countries.",
      onScreenText: "900,000 STUDENTS. 49 COUNTRIES.",
      visualDirection: "large crowd audience event stadium people",
      pexelsQuery: "large crowd audience event stadium people"
    },
    {
      sceneNumber: 4,
      duration: 8,
      voiceoverText: "Your campaign goes straight to Meta. No agency. No copying and pasting. Done in minutes.",
      onScreenText: "STRAIGHT TO META. TODAY.",
      visualDirection: "person on phone happy successful business results smartphone",
      pexelsQuery: "person on phone happy successful business results smartphone"
    },
    {
      sceneNumber: 5,
      duration: 8,
      voiceoverText: "Stop being invisible. Your next client is already on Facebook — they just haven't seen you yet.",
      onScreenText: "THEY HAVEN'T SEEN YOU YET.",
      visualDirection: "confident entrepreneur smiling success celebration",
      pexelsQuery: "confident entrepreneur smiling success celebration"
    }
  ],
  totalDuration: 28, // Scenes total
  urlDisplay: {
    start: 23,
    end: 28,
    text: "zapcampaigns.com"
  },
  fadeOut: {
    start: 28,
    end: 30
  }
};

export const ZAP_DEMO_VOICEOVER = ZAP_DEMO_SCRIPT.scenes
  .map(s => s.voiceoverText)
  .join(" ");
