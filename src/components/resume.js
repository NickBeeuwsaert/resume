import { h } from 'preact';

import Section from './section';
import Header from './header';
import Job from './job';
import School from './school';

export default function Resume({basic, work, education}) {
    return <div>
        <Header {...basic}/>
        <Section title="Experience">
            {work.map(job => <Job {...job}/>)}
        </Section>
        <Section title="Education">
            {education.map(school => <School {...school}/>)}
        </Section>
    </div>;
}