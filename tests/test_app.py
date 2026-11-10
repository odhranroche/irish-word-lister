"""Browser tests for dist/index.html (headless Chromium through Playwright).

    python3 build.py && python3 tests/test_app.py

Needs: pip install playwright && playwright install chromium
Each test loads the built page, sets the input text and settings, runs the same code as the
Remove duplicates button, and checks the cleaned list. The two fixture counts are snapshots:
when a rule change moves them on purpose, check the difference and update the number.
"""
import asyncio
import os
import sys

from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = 'file://' + os.path.join(ROOT, 'dist', 'index.html')
FIX = os.path.join(ROOT, 'tests', 'fixtures')
DEFAULTS = {'noun': True, 'adj': True, 'verb': True, 'vn': True, 'vnall': False, 'irr': False, 'prep': False,
            'abs': False, 'dictonly': True, 'eng': True, 'short': False, 'shorthead': False}

failures = []


def check(name, got, want):
    ok = got == want
    print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else f'\n     got:  {got}\n     want: {want}'))
    if not ok:
        failures.append(name)


async def open_page(browser, no_decompression_stream=False):
    ctx = await browser.new_context()
    if no_decompression_stream:
        await ctx.add_init_script('delete window.DecompressionStream')
    page = await ctx.new_page()
    errors, requests = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if 'Content Security Policy' in m.text else None)
    page.on('request', lambda r: requests.append(r.url))
    await page.goto(PAGE)
    await page.wait_for_function('typeof DICT !== "undefined" && DICT.ready', timeout=60000)
    await page.evaluate('localStorage.clear()')
    return page, errors, requests


async def clean(page, text, **opts):
    """Cleaned word list for text, with the default settings changed by opts."""
    o = {**DEFAULTS, **opts}
    return await page.evaluate("""([text, o]) => {
        for (const [k, v] of Object.entries(o)) document.getElementById('opt-' + k).checked = v;
        readOpts();
        document.getElementById('input').value = text;
        work();
        const t = cleanedTXT();
        return t ? t.split('\\n') : [];
    }""", [text, o])


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page, errors, requests = await open_page(browser)

        # dictionary
        n = await page.evaluate('[DICT.lemmas.length, DICT.forms.size]')
        check('dictionary loads', n, [42769, 171221])

        # rules
        check('noun, adjective and verb forms', await clean(page, 'bróga bróg báid bád móra mór mholann moladh mol scoile scoil'),
              ['bád', 'bróg', 'mol', 'mór', 'scoil'])
        check('t- prefix and bracketed letters', await clean(page, 'tAthair athair c(h)uid'), ['athair', 'cuid'])
        check('certain mutation with unknown base', await clean(page, 'ghnáthlá'), ['gnáthlá'])
        check('irregular verbs before the dictionary', await clean(page, 'rinne chonaic fuair', irr=True), ['déan', 'faigh', 'feic'])
        check('hyphenated intensifier, standard spelling', await clean(page, 'Bhí an-aiféal orm.'), ['aiféala', 'bí', 'orm'])
        check("s' and emphatic -nne", await clean(page, "an teach s'againne", prep=True), ['ag', 'an', 'teach'])
        check('verbal noun chain', await clean(page, 'chumadh', vnall=True), ['cum'])

        # English and names
        check('English "the" is not Irish te', await clean(page, 'the'), [])
        check('Irish "the" (lenited te) is kept', await clean(page, 'Bhí oíche the ann.'), ['ann', 'bí', 'oíche', 'te'])
        check('English apostrophe words', await clean(page, "It's Tom's house. Tá teach ann."), ['ann', 'tá', 'teach'])
        check('lower-case names', await clean(page, 'chuaigh seán agus máire go gaillimh'), ['agus', 'chuaigh', 'go'])

        # choices belong to one document
        await clean(page, 'bád báid')
        await page.evaluate("dropWord('bád', true)")
        check('removal applies to the same text', await clean(page, 'bád báid'), [])
        check('removal does not carry to new text', await clean(page, 'bád bróg'), ['bád', 'bróg'])

        # hostile or unusual text
        out = await clean(page, '<script>window.pwned=1</script><img src=x onerror="window.pwned=2"> bád')
        await page.evaluate('go(3)')
        check('markup in the text never runs', ['bád' in out, await page.evaluate('window.pwned || 0'),
              await page.evaluate("document.querySelectorAll('#p3 img, #p3 script, #found img').length")], [True, 0, 0])
        check("words like 'constructor' are plain words", await clean(page, 'constructor hconstructor', prep=True), ['constructor', 'hconstructor'])
        check('accents typed as combining marks', await clean(page, 'ba\u0301id ba\u0301d b\u200bád'), ['bád'])
        check('tokens over 40 letters are ignored', await clean(page, 'a' * 100000 + ' bád'), ['bád'])

        # CSV safety
        check('CSV formula cells are escaped', await page.evaluate("[csvCell('=1+1'), csvCell('a,b'), csvCell('bád')]"),
              ["'=1+1", '"a,b"', 'bád'])

        # fixtures (snapshots)
        for name, want in (('cursai-oibre.txt', 636), ('an-teaghlach.txt', 437)):
            text = open(os.path.join(FIX, name), encoding='utf-8').read()
            check(f'{name} with default settings', len(await clean(page, text)), want)

        check('no page errors', errors, [])
        check('no network requests', [r for r in requests if not r.startswith(('file:', 'data:', 'blob:'))], [])

        # dictionary fallback for browsers without DecompressionStream
        page2, errors2, _ = await open_page(browser, no_decompression_stream=True)
        check('fallback inflater gives the same dictionary', await page2.evaluate('[DICT.lemmas.length, DICT.forms.size]'), n)
        check('no page errors (fallback)', errors2, [])
        await browser.close()

    print(f'\n{len(failures)} failed' if failures else '\nall passed')
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    asyncio.run(main())
