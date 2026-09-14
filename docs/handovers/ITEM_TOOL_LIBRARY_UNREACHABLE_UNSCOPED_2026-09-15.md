# UNSCOPED PRODUCT DECISION: the Tool Library is not reachable in the product (logged 2026-09-15)

**Status: logged for a later product decision. NOT scoped, NOT authorised, NOT built.**

This is a navigation question, not a video-scripts one.

## 1. What is true today

**The Tool Library is not rendered anywhere in the V2 product. That was true before the video-scripts deploy (`87596d7`)
and is still true after it.**

- **The dashboard never renders it.** `client/src/v2/V2Dashboard.tsx` imports `V2ToolLibrary` (`:11`) and never renders
  it. The only component its JSX renders is `<V2Layout`.
- **The "Jump to Tool Library" button does nothing on screen.** It lives in the dashboard's fork modal (`:226-228`) and
  sets `activeTab = "tools"` (`:460`, `:464`). `activeTab` is declared at `:268`, and **nothing in the render reads it**.
  The `?tab=tools` query parameter sets the same unread state.
- **The bundler strips it.** No route renders the component (`client/src/App.tsx`), and none of its own strings are in
  the bundle: "Back to Tool Library", "17-section deep-dive into who your perfect buyer is" and its card descriptions
  count **0** in both the pre-deploy live bundle (`index-Duou2EVh.js`) and the `87596d7` build.
  - "5 scroll-stopping ad image variations" does appear, but it comes from `V2AdImageCreator.tsx`, not from the
    Tool Library.

## 2. What this means for past records

- **The video-scripts package listed "Tool Library → Video Creator / Video Scripts card" as a place coaches hit the
  video-script gap, and as a second entry point for the new screen. Both were wrong:** no coach can reach that card.
  The error was found before the push, by the §15h marker count, not after. The four video-scripts handover documents
  are corrected to say so.
- **The package's edit to `V2ToolLibrary.tsx` is inert:** a renamed card and a `V2ConceptScripts` mount. It is harmless,
  and it will work as written only if the Tool Library is ever rendered.
- **Not a broken promise from the deploy:** the Tool Library was never live before this work, and is not live after it.

## 3. The decision, for later

1. **Should the Tool Library exist in the V2 product at all?** Its cards duplicate generators the guided trail already
   runs, and the Duolingo principle (CLAUDE.md §5.1) keeps work inside nodes.
2. **If yes, where does it go?** A dashboard tab (the unread `activeTab` state suggests one was intended), or a route.
3. **If no:** remove the dead import, the unread `activeTab` state, the "Jump to Tool Library" button and `?tab=tools`,
   so nothing implies it exists.
4. **Either way:** the "Jump to Tool Library" button is live today and does nothing visible when clicked.
