import { Routes } from '@angular/router';
import { Homepage } from './core/components/homepage/homepage';
import { Login } from './core/components/login/login';
import { Logout } from './core/components/logout/logout';
import { NewMatch } from './core/components/new-match/new-match';
import { MatchArena } from './core/components/match-arena/match-arena';
import { Signup } from './core/components/signup/signup';
import { PersonalArea } from './core/components/personal-area/personal-area';

import { authGuard } from './core/guards/auth/auth-guard'; 

export const routes: Routes = [
    {
        path: "home",
        component: Homepage,
        title: "Homepage"
    }, {
        path: "login",
        component: Login,
        title: "Login"
    }, {
        path: "logout",
        component: Logout,
        title: "Logout"
    },{
        path: "signup",
        component: Signup,
        title: "Signup"
    }, {
        path: "new-match",
        component: NewMatch,
        title: "New Match"
    }, {
        path: 'match-arena/:id',
        component: MatchArena,
        title: "Match Arena"
    }, {
        path: "personal-area",
        component: PersonalArea,
        title: "Personal Area",
        canActivate: [authGuard]
    }, {
        path: "",
        redirectTo: "/home",
        pathMatch: 'full'
    },
];