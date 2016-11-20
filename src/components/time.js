import { h } from 'preact';

export default function Time({datetime, locale, options={}}) {
    let date = new Date(datetime);
    return <time datetime={datetime}>{date.toLocaleString(locale, options)}</time>
}