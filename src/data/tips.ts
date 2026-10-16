/**
 * Tips shown one at a time along the bottom of the screen when UJI opens (see
 * LaunchTip): how tokens work, and the shortcuts and settings that are easy to
 * miss. "{mod}" becomes ⌘ on a Mac and Ctrl everywhere else.
 */
export const TIPS: string[] = [
  'A Challenge answer right on the first try, with no hints, earns 10 tokens. With hints you still get a few.',
  'Tokens buy tickets for Trip on da Ship: 50 for the time of day it is now, 100 for the other one.',
  'Fish you catch on da Ship swim in your fishbowl. Right-click the bowl to switch fish.',
  'Get every answer in a practice set right on the first try to earn that topic’s sticker.',
  'Press {mod}+K to search every math tool, and {mod}+B to open or close the backpack.',
  'Type a problem straight into the backpack, like x² − 5x + 6 = 0, and UJI opens the right tool.',
  'Homework on paper? Tap the camera to snap it, or paste a screenshot right into a tool.',
  'Lesson mode walks through a problem one step at a time. Switch with the Cheat / Lesson pill.',
  'Every worked step has a “why?” link that jumps to that step in Lesson mode.',
  'Focus a window’s title bar, then use the arrow keys to move it and Shift+arrows to resize it.',
  'Turn on grid snapping and alignment guides in Settings → Window arrangement. Hold Alt to place freely.',
  'Right-click the whiteboard to tidy up all your windows at once.',
  'Save your board as a desk in the backpack, one for each class, and switch between them anytime.',
  'Drop a sticker onto a window and it sticks there, moving and minimizing along with it.',
  'Settings → Text size makes everything bigger, windows included, so nothing gets cut off.',
  'Pick Dynamic under Settings → Appearance, and UJI goes dark at 7pm and light again at 6am.',
  'Sign in from Settings → Account to keep your tokens, fish and desks on every device.',
];

/** The tip with {mod} filled in for this computer's modifier key. */
export function tipText(index: number, mac: boolean): string {
  return TIPS[((index % TIPS.length) + TIPS.length) % TIPS.length].replace(/\{mod\}/g, mac ? '⌘' : 'Ctrl');
}
