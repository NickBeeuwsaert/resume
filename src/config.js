export const LOCALE = ['xml:lang', 'lang'].reduce(
    (winner, contender) => winner ? winner : document.documentElement.getAttribute(contender),
    undefined
) || 'en-US';

