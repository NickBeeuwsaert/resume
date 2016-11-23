import { h } from 'preact';

let Icon = ({type}) => <span className={`icon icon-${type}`}></span>;

export default function Header({name, label, phone, email, website, profiles=[]}) {
    return <header className="resume-header">
        <div>
            <h1>{name}</h1>
            <h2>{label}</h2>
        </div>
        <div className="aside">
            <ul className="contact">
                <li>
                    <Icon type="phone"/>
                    <a className="censored" title="Censored for my privacy" href={`tel:${phone}`}>{phone}</a>
                </li>
                <li>
                    <Icon type="email"/>
                    <a className="censored" title="Censored for my privacy" href={`mailto:${email}`}>{email}</a>
                </li>
                <li>
                    <Icon type="internet"/>
                    <a href={website}>{website}</a></li>
                {profiles.map(profile => <li>
                    <Icon type={profile.network}/>
                    <a href={profile.url}>{profile.username}</a>
                </li>)}
            </ul>
        </div>
    </header>;
}
