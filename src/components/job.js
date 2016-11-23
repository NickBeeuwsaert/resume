import { h } from 'preact';

import { LOCALE } from '../config';
import Time from './time';

export default function Job({
    company, position,
    start_date, end_date,
    summary, highlights
}) {
    let dateOptions = {year: 'numeric', month: 'long', timeZone: 'UTC'};


    return <article>
        <div className="article-header">
            <div>
                <h3>{position}</h3>
                <small><em>{company}</em></small>
            </div>
            <div className="aside">
                <h3>
                    <Time datetime={start_date} locale={LOCALE} options={dateOptions}/> &ndash; <Time datetime={end_date} locale={LOCALE} options={dateOptions}/>
                </h3>
            </div>
        </div>
        <p>{summary}</p>
        <ul className="job-highlights">
            {highlights.map(highlight => <li>{highlight}</li>)}
        </ul>
    </article>;
}
