# Game-over results UI audit

1. `src/game/scenes/gameOverScene.ts:29` draws survival time and Final cash onto the canvas, so assistive technology and browser automation cannot refer to their individual values. Move the summary to semantic DOM fields with stable IDs.
2. `public/style.css:103` stretches the persistence status notice across the bottom of the viewport, visually disconnecting Retry saving from the result it saves. Position it at the top centre and size it from the same result-panel width token.
3. `index.html:26` has no semantic container for the completed-run outcome. Add a labelled results section with a definition list so its label/value relationships are explicit.

## Deferred

No shared component is warranted: this is the only game-over result summary, and the repository uses native semantic HTML and CSS custom properties rather than a component library.
