import { render, h, Component } from 'preact';

import Resume from './components/resume';
import resume from '../resume.json';

render(<Resume {...resume}/>, document.getElementById("resume-container"));
