import MagicString from 'magic-string';

const MEMCPY_REQUIRE_STRING = 'require("memcpy")';
const REPLACEMENT_STRING = 'null';

// We're doing this because memcpy is an optional dependency of ByteBufferNB,
// but Rollup doesn't understand optional dependencies and tries to use it.
// We can't simply use memcpy, because it has native code for older versions of
// Node and no longer builds!
export default (variant) => {
    let mainId = null;

    return {
        name: 'no-memcpy-plugin'
      , transform: (code, id) => {
            if (id.endsWith('ByteBufferNB.js')) {
                const start = code.indexOf(MEMCPY_REQUIRE_STRING);

                if (start >= 0) {
                    const magicString = new MagicString(code);
                    const end = start + MEMCPY_REQUIRE_STRING.length;
                    magicString.overwrite(start, end, REPLACEMENT_STRING);

                    return {
                        code: magicString.toString()
                      , map: magicString.generateMap()
                    };
                }
            }

            return null;
        }
    }
}
