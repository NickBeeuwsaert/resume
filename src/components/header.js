import { h } from 'preact';

export default function Header({name, label, phone, email, website, profiles=[]}) {
    return <div class="resume-header">
        <div>
            <h1>{name}</h1>
            <h2>{label}</h2>
        </div>
        <div class="align-right">
            <ul class="contact">
                <li><a href={`tel:${phone}`}>{phone}</a></li>
                <li><a href={`mailto:${email}`}>{email}</a></li>
                <li><a href={website}>{website}</a></li>
                {profiles.map(profile => <li>
                    <span class={`icon icon-${profile.network}`}></span> 
                    <a href={profile.url}>{profile.username}</a>
                </li>)}
            </ul>
        </div>
    </div>;
}
