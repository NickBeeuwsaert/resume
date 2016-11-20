import { h } from 'preact';

export default function Section({title, children}) {
    return <section>
        <h1>{title}</h1>
        <hr/>
        {children}
    </section>;
}
