# Asset naming rules

- Give every runtime asset a descriptive, production-style name based on its role, subject, state or animation, using lowercase kebab-case where possible.
- Never use `placeholder` or another provisional label in asset filenames, runtime keys, titles or definition paths. Generated or temporary artwork and audio must still receive the name it would keep if shipped.
- Keep related variants explicit, for example `engines-off.svg`, `engine-on-sequence.svg`, `laser-shot.wav` or `engine-loop.wav`.
- When renaming an asset, update its definition, offline generator, focused tests and documentation in the same change.
