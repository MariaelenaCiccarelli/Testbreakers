export interface MatchAuthState {
    p1: {
        handle: string | null;
        token: string | null;
        role: string | null;
        avatar: string | null;
    };
    p2: {
        handle: string | null;
        token: string | null;
        role: string | null;
        avatar: string | null;
    };
    isAuthenticated: boolean;
}

export interface NewMatchRequest {
    p1Handle: string | null;
    p1Password: string | null;
    p2Handle: string | null;
    p2Password: string | null;
    p2Role: string | null;
}

export interface NewMatchResponse {
    match: {
        matchId: number | null;
        coderId: number | null;
        testerId: number | null;
        challengeId: number | null;
        status: string | null;
        winnerId: number | null;
        abandonedById: number | null
    };
    coderAvatar: string | null;
    testerAvatar: string | null;
    coderHandle: string | null;
    testerHandle: string | null;
    matchTokens: {
        player1: string | null;
        player2: string | null
    };
}