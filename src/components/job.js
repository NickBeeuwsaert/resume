import { h } from 'preact';

import { LOCALE } from '../config';

export default function Job({
    company, position,
    start_date, end_date,
    summary, highlights
}) {
    start_date = new Date(start_date);
    end_date = new Date(end_date);


    return <article>
        <div class="article-header">
            <div>
                <h3>{position}</h3>
                <small><em>{company}</em></small>
            </div>
            <div class="align-right">
                <h3>{start_date.toLocaleDateString(LOCALE, {
                    year: 'numeric',
                    month: 'long',
                    timeZone: 'UTC'
                })} &ndash; {end_date.toLocaleDateString(LOCALE, {
                    year: 'numeric',
                    month: 'long',
                    timeZone: 'UTC'
                })}</h3>
            </div>
        </div>
        <p>{summary}</p>
        <ul class="job-highlights">
            {highlights.map(highlight => <li>{highlight}</li>)}
        </ul>
    </article>;
}
