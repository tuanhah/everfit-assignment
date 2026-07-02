import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { Exercise } from '../exercises/exercise.entity';
import { WorkoutSet } from './set.entity';

/**
 * One logged exercise on one date for one user.
 * id is a UUIDv7 generated app-side: time-ordered (sequential B-tree
 * inserts) and known before INSERT, so entry + sets go in one round-trip.
 */
@Entity('workout_entries')
export class WorkoutEntry {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'text', name: 'user_id' })
  userId: string;

  @Column({ type: 'int', name: 'exercise_id' })
  exerciseId: number;

  @ManyToOne(() => Exercise)
  @JoinColumn({ name: 'exercise_id' })
  exercise: Exercise;

  /** Business date the workout happened on, decided by the client. */
  @Column({ type: 'date', name: 'workout_date' })
  workoutDate: string;

  /** Audit timestamp of when the entry was recorded (UTC). */
  @Column({
    type: 'timestamptz',
    name: 'logged_at',
    default: () => 'now()',
  })
  loggedAt: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => WorkoutSet, (set) => set.entry, { cascade: ['insert'] })
  sets: WorkoutSet[];
}
