import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Exercise catalog row. Name is unique case-insensitively
 * (enforced by a LOWER(name) unique index in the migration).
 * Muscle-group mapping is seeded from config, not hardcoded.
 */
@Entity('exercises')
export class Exercise {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', name: 'muscle_group' })
  muscleGroup: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
