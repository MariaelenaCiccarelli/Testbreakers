import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PersonalArea } from './personal-area';

describe('PersonalArea', () => {
  let component: PersonalArea;
  let fixture: ComponentFixture<PersonalArea>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalArea]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PersonalArea);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
