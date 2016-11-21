import { h } from 'preact';

export default function Header({name, label, phone, email, website, profiles=[]}) {
    return <header class="resume-header">
        <div>
            <h1>{name}</h1>
            <h2>{label}</h2>
        </div>
        <div class="aside">
            <ul class="contact">
                <li><span class='icon icon-phone'></span><a href={`tel:${phone}`}>{phone}</a></li>
                <li><span class='icon icon-email'></span><a href={`mailto:${email}`}>{email}</a></li>
                <li><span class='icon icon-internet'></span><a href={website}>{website}</a></li>
                {profiles.map(profile => <li>
                    <span class={`icon icon-${profile.network}`}></span> 
                    <a href={profile.url}>{profile.username}</a>
                </li>)}
            </ul>
        </div>
    </header>;
}
