/**
 * PageMint recipe for cliffdemo3 / THE CLIFF NEWS — sent inside every
 * NMS → PageMint bundle as `pageMintRecipe`.
 *
 * PageMint reads it ONLY inside the headless NMS export page
 * (`?nmsExport=1`, see PageMint `src/lib/nms/cliffDemo3ManualRecipe.ts`
 * → getNmsExportRecipe()). The manual wizard never sees this object, so
 * nothing here can change a publisher's manual PDF.
 *
 * Golden reference: PageMint job JOB-1789496500091-94728FA0 (15 Sep 2026) —
 * the NMS PDF that matched the manual wizard. That look is:
 *   - every headline: Cliff Noto Sans Devanagari 700, filled to column width
 *   - body: Cliff Noto Sans Devanagari 400, browser justification engine
 *   - palette: wizard default "classic" (black band) at 100 % opacity
 *   - byline: the newspaper name (द क्लिफ न्यूज़ • place), like the wizard
 *   - 3 subheadings per story (wizard shows 2 bullets + uses the 3rd where a
 *     box has room), captions on, tinted story backgrounds on
 *
 * Keys are per STORY ROLE (lead / major / secondary / brief / filler), never
 * per template slot — so changing the front/inside layout in
 * `newspaperGenerator.js` (CLIFF_FRONT_RAIL_LAYOUT / frontPageLayout) does not
 * change the typography. To change fonts for NMS PDFs, edit this file only,
 * restart the NMS backend, and run PageMint's verifier
 * (`scripts/verify-nms-typography.sh`). Full guide:
 * docs/NMS_PAGEMINT_PDF_RUNBOOK.md (same file lives in PageMint `docs/`).
 */
function buildCliffDemo3PageMintRecipe() {
    return {
        schemaVersion: 'nms-pagemint-manual-recipe-v4',
        publisherId: 'cliffdemo3',
        newspaperName: 'THE CLIFF NEWS',
        newspaperNameHi: 'द क्लिफ न्यूज़',

        layout: {
            // Informational: PageMint takes the template from the bundle's
            // `layout` / `frontPageLayout` field (newspaperGenerator.js).
            frontTemplateId: 'CliffFrontEditorRail8A',
            frontTemplateLabel: 'एडिटर रेल फ्रंट पेज (8 बॉक्स)',
            insideDefaultTemplateId: 'IndianFront6A',
            railAuthorSource: 'bundle_sender',
            story1Role: 'editorial_rail',
            story2Role: 'page_lead',
        },

        // Mirrors GenerationWizardModal's createInitialWizardState() defaults.
        importOptions: {
            languageMode: 'hindi',
            colouredHeadings: false,
            tintedStoryBackground: true,
            inlineColumnSubheadings: true,
            bodyAlignment: 'justify',
            professionalJustification: true,
            isBatchGeneration: true,
            nmsBylinePortrait: false,
            // Wizard default: 100 % band opacity, fixed "classic" palette.
            subheadingBandOpacity: 1,
            // 'classic_fixed'  -> wizard default palette on every page (this look)
            // 'rotate_unused_manual_batch' -> deterministic per-job rotation
            paletteMode: 'classic_fixed',
            // 'newspaper_name' -> byline = publication name (wizard default)
            // anything else    -> bundle sender / reporter name
            bylineSource: 'newspaper_name',
            // NMS automated cliffdemo3 exports only: preserve the publication
            // byline and add the real article reporter as one compact line above it.
            reporterNameAboveByline: true,
        },

        fonts: {
            // false = keep PageMint's normal font stacks (family, Noto, serif).
            primaryOnlyNoStackFallback: false,
            blockExportIfDisplayMatchesNoto: true,
            // One face for every role => identical typography on any layout.
            headlineByPriority: {
                lead:      { family: 'Cliff Noto Sans Devanagari', weight: '700' },
                major:     { family: 'Cliff Noto Sans Devanagari', weight: '700' },
                secondary: { family: 'Cliff Noto Sans Devanagari', weight: '700' },
                brief:     { family: 'Cliff Noto Sans Devanagari', weight: '700' },
                filler:    { family: 'Cliff Noto Sans Devanagari', weight: '700' },
            },
            body: {
                // Anything other than the wizard's ExtraCondensed face is drawn
                // at weight 400 (composeArticleBox, NMS export only).
                hindi: 'Cliff Noto Sans Devanagari',
                english: 'Tinos',
            },
            subhead: 'Cliff Noto Sans Devanagari',
            byline: 'Cliff Noto Sans Devanagari',
            caption: 'Cliff Noto Sans Devanagari',
        },

        typographyFit: {
            // true = headlines are stretched to the column width like the wizard.
            stretchDisplayHeadlines: true,
            maxHeadlineScaleX: 1.0,
            sentenceEndFitting: true,
            justifyBody: true,
            professionalJustification: true,
        },

        subheads: {
            inlineColumnSubheadings: true,
            stripSubheadingBands: true,
            bandBackgroundOpacity: 1,
            useManualBatchPaletteRotation: false,
            // Cap on subheadings passed per story (0 removes them).
            maxSubheadingsPerStory: 3,
        },

        images: {
            preferCoverImage: true,
            drawStoryImages: true,
            bylinePortraitInArticleBox: false,
            railPortraitFromEditorialAuthors: true,
        },

        pdfEngine: {
            renderer: 'pagemint-editor-headless',
            burnPath: 'buildDocumentPdfBytes/renderDocumentPageToDataUrl',
            dpi: 300,
            embed: 'png',
            waitFontsBeforeComposeMs: 45000,
            waitFontsBeforeBurn: true,
            attachCanvasForFontFace: true,
            clearTextMeasurementCacheBeforeBurn: true,
        },

        textEngine: {
            contentLanguageFromDevanagariHeadline: true,
            forceHindiWhenDevanagari: true,
            cleanNmsBodyLabels: true,
        },
    };
}

module.exports = {
    buildCliffDemo3PageMintRecipe,
};
