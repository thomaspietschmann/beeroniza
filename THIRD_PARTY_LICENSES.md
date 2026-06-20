# Third-Party Licenses — Bundled Fonts

beeroniza bundles a curated set of open-source fonts so the editor and the
image-rendering API work fully offline, without any font CDN.

All bundled fonts are licensed under the **SIL Open Font License (OFL) 1.1** or
the **Apache License 2.0**. Each font is **redistributed unmodified** — it has
not been subsetted, renamed, re-hinted, or converted — which keeps us clear of
the OFL "Reserved Font Name" rules. The complete, original license text for
each family is shipped alongside its font files in `public/fonts/<family>/`
(`OFL.txt` or `LICENSE.txt`).

Both the OFL and Apache 2.0 explicitly permit redistribution and embedding.
**Images rendered with these fonts carry no font-license restriction** — the
licenses govern the font software itself, not documents or images produced with
the fonts.

The fonts were obtained from the authoritative
[google/fonts](https://github.com/google/fonts) repository. The source column
links to each family's upstream directory.

## Bundled families

| Family | Category | License | Weights | Source (google/fonts) | License text |
| --- | --- | --- | --- | --- | --- |
| Inter | sans | OFL 1.1 | 100–900 (variable) | [inter](https://github.com/google/fonts/tree/main/ofl/inter) | `public/fonts/inter/` |
| Roboto | sans | OFL 1.1 | 100–900 (variable) | [roboto](https://github.com/google/fonts/tree/main/ofl/roboto) | `public/fonts/roboto/` |
| Open Sans | sans | OFL 1.1 | 100–900 (variable) | [opensans](https://github.com/google/fonts/tree/main/ofl/opensans) | `public/fonts/opensans/` |
| Lato | sans | OFL 1.1 | 400, 600, 700 | [lato](https://github.com/google/fonts/tree/main/ofl/lato) | `public/fonts/lato/` |
| Montserrat | sans | OFL 1.1 | 100–900 (variable) | [montserrat](https://github.com/google/fonts/tree/main/ofl/montserrat) | `public/fonts/montserrat/` |
| Poppins | sans | OFL 1.1 | 400, 600, 700 | [poppins](https://github.com/google/fonts/tree/main/ofl/poppins) | `public/fonts/poppins/` |
| Work Sans | sans | OFL 1.1 | 100–900 (variable) | [worksans](https://github.com/google/fonts/tree/main/ofl/worksans) | `public/fonts/worksans/` |
| Nunito | sans | OFL 1.1 | 100–900 (variable) | [nunito](https://github.com/google/fonts/tree/main/ofl/nunito) | `public/fonts/nunito/` |
| Raleway | sans | OFL 1.1 | 100–900 (variable) | [raleway](https://github.com/google/fonts/tree/main/ofl/raleway) | `public/fonts/raleway/` |
| Merriweather | serif | OFL 1.1 | 100–900 (variable) | [merriweather](https://github.com/google/fonts/tree/main/ofl/merriweather) | `public/fonts/merriweather/` |
| Playfair Display | serif | OFL 1.1 | 100–900 (variable) | [playfairdisplay](https://github.com/google/fonts/tree/main/ofl/playfairdisplay) | `public/fonts/playfairdisplay/` |
| Lora | serif | OFL 1.1 | 100–900 (variable) | [lora](https://github.com/google/fonts/tree/main/ofl/lora) | `public/fonts/lora/` |
| Oswald | display | OFL 1.1 | 100–900 (variable) | [oswald](https://github.com/google/fonts/tree/main/ofl/oswald) | `public/fonts/oswald/` |
| Bebas Neue | display | OFL 1.1 | 400 | [bebasneue](https://github.com/google/fonts/tree/main/ofl/bebasneue) | `public/fonts/bebasneue/` |
| JetBrains Mono | mono | OFL 1.1 | 100–900 (variable) | [jetbrainsmono](https://github.com/google/fonts/tree/main/ofl/jetbrainsmono) | `public/fonts/jetbrainsmono/` |
| Roboto Mono | mono | OFL 1.1 | 100–900 (variable) | [robotomono](https://github.com/google/fonts/tree/main/ofl/robotomono) | `public/fonts/robotomono/` |

> Variable-font families ship a single variable `.ttf` covering the full
> 100–900 weight axis; the `@font-face` blocks in `src/styles/_fonts.scss`
> declare `font-weight: 100 900` for them. Lato and Poppins ship static
> instance files upstream, so individual weights are bundled.

The font list, downloads, and the generated `src/styles/_fonts.scss` /
`src/lib/fonts/bundled.ts` are produced by `scripts/fetch-fonts.ts`
(`npm run fonts:fetch`).
