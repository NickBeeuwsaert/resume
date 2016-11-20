import { h } from 'preact';

import { LOCALE } from '../config';

export default function School({
    institution, location,
    start_date, end_date
}) {
    start_date = new Date(start_date);
    end_date = new Date(end_date);

    return <article>
        <div class="article-header">
            <div>
                <h3>{institution}</h3>
                <small><em>{location}</em></small>
            </div>
            <div class="align-right">
                <h3>{start_date.toLocaleDateString(LOCALE, {
                    year: 'numeric',
                    timeZone: 'UTC'
                })} &ndash; {end_date.toLocaleDateString(LOCALE, {
                    year: 'numeric',
                    timeZone: 'UTC'
                })}</h3>
            </div>
        </div>
    </article>;
}
