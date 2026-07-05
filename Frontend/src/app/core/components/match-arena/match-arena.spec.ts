import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchArena } from './match-arena';

describe('MatchArena', () => {
  let component: MatchArena;
  let fixture: ComponentFixture<MatchArena>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchArena]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MatchArena);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
