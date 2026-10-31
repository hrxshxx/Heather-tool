// Terminal colors and the Heather banner (purple to pink, like the logo)

const truecolor = /truecolor|24bit/i.test(process.env.COLORTERM || "") || process.env.TERM_PROGRAM === "iTerm.app";

// Gradient stops, top to bottom
const STOPS = [[0x8a, 0x1c, 0xf5], [0xe6, 0x2b, 0xef], [0xec, 0x2f, 0x94]];

function gradient(t) {
  const scaled = t * (STOPS.length - 1);
  const i = Math.min(Math.floor(scaled), STOPS.length - 2);
  const f = scaled - i;
  return STOPS[i].map((c, k) => Math.round(c + (STOPS[i + 1][k] - c) * f));
}

function fg([r, g, b]) {
  if (truecolor) return `\x1b[38;2;${r};${g};${b}m`;
  // Closest color in the 256-color cube for terminals without truecolor
  const q = (v) => Math.round((v / 255) * 5);
  return `\x1b[38;5;${16 + 36 * q(r) + 6 * q(g) + q(b)}m`;
}

const reset = "\x1b[0m";
const purple = (text) => `${fg(STOPS[0])}${text}${reset}`;
const pink = (text) => `${fg(STOPS[1])}${text}${reset}`;
const bold = (text) => `\x1b[1m${text}${reset}`;
const dim = (text) => `\x1b[2m${text}${reset}`;
const green = (text) => `\x1b[32m${text}${reset}`;
const yellow = (text) => `\x1b[33m${text}${reset}`;
const red = (text) => `\x1b[31m${text}${reset}`;

const LOGO = [
  "██╗  ██╗███████╗ █████╗ ████████╗██╗  ██╗███████╗██████╗ ",
  "██║  ██║██╔════╝██╔══██╗╚══██╔══╝██║  ██║██╔════╝██╔══██╗",
  "███████║█████╗  ███████║   ██║   ███████║█████╗  ██████╔╝",
  "██╔══██║██╔══╝  ██╔══██║   ██║   ██╔══██║██╔══╝  ██╔══██╗",
  "██║  ██║███████╗██║  ██║   ██║   ██║  ██║███████╗██║  ██║",
  "╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝",
];

// Each row is shifted right a bit more than the one below it to slant the
// letters, solid blocks get the gradient and the outline gets a darker shadow
function banner() {
  return LOGO.map((row, r) => {
    // The last row is only outline, so the solid rows get the whole gradient
    const color = gradient(Math.min(r / (LOGO.length - 2), 1));
    const shadow = color.map((c) => Math.round(c * 0.45));
    const slant = " ".repeat(LOGO.length - r);
    const painted = row.replace(/█+|[^█ ]+/g, (part) => (part[0] === "█" ? fg(color) : fg(shadow)) + part);
    return "  " + slant + painted + reset;
  }).join("\n");
}

module.exports = { banner, purple, pink, bold, dim, green, yellow, red };
