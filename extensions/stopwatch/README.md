# Stopwatch

A simple stopwatch for the Muxy status bar. Adds a stopwatch icon to the right
side of the footer status bar; click it to open a small popover with a live
`HH:MM:SS` readout and three controls — **Start**, **Stop**, **Restart**. Click
outside to dismiss.

![Stopwatch popover open over the Muxy status bar](assets/screenshot-1.png)

## Controls

- **Start** — begins counting, or resumes after a stop.
- **Stop** — pauses and freezes the elapsed time.
- **Restart** — resets to `00:00:00` and immediately starts counting again.

The stopwatch keeps running while the popover is closed: it persists its state
to `localStorage` and computes elapsed time from the stored start timestamp, so
reopening the popover shows the correct time. There is no background process.

## Permissions

- **`panels:write`** — lets the popover size itself to its content
  (`muxy.popover.resize`). No network, no shell, no workspace access.

## How it works

- A `statusBarItem` (right side, stopwatch icon) runs the `open` command.
- That command's `openPopover` action opens the `stopwatch` popover.
- `popovers/stopwatch.html` renders the elapsed time and the three buttons,
  updating roughly four times a second while running. It uses the injected
  `--muxy-*` theme variables and a transparent background so the native popover
  material shows through.

## License

MIT
