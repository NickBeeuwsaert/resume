import { h } from 'preact';

import { LOCALE } from '../config';
import Time from './time';

export default function School({
    institution, location,
    start_date, end_date
}) {
    let dateOptions = {
        year: 'numeric',
        timeZone: 'UTC'
    };

    return <article>
        <div class="article-header">
            <div>
                <h3>{institution}</h3>
                <small><em>{location}</em></small>
            </div>
            <div class="align-right">
                <h3>
                    <Time datetime={start_date} locale={LOCALE} options={dateOptions}/> &ndash; <Time datetime={end_date} locale={LOCALE} options={dateOptions}/>
                </h3>
            </div>
        </div>
    </article>;
}
