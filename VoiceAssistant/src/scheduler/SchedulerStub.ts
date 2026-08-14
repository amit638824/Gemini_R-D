import { ScheduledCheckIn } from '../agent/types';

export class SchedulerStub {
  private static checkIns: ScheduledCheckIn[] = [
    {
      id: 'checkin_1',
      title: 'Meeting wrap-up check-in',
      durationMinutes: 35,
      warnBeforeMinutes: 5,
      targetTimestamp: Date.now() + 35 * 60 * 1000,
      status: 'pending',
    },
  ];

  static scheduleCheckIn(durationMinutes: number, warnBeforeMinutes = 5): ScheduledCheckIn {
    const checkIn: ScheduledCheckIn = {
      id: `checkin_${Date.now()}`,
      title: `Check-in in ${durationMinutes} min`,
      durationMinutes,
      warnBeforeMinutes,
      targetTimestamp: Date.now() + durationMinutes * 60 * 1000,
      status: 'pending',
    };
    SchedulerStub.checkIns.push(checkIn);
    return checkIn;
  }

  static getPendingCheckIns(): ScheduledCheckIn[] {
    return SchedulerStub.checkIns.filter(c => c.status === 'pending');
  }

  static cancelCheckIn(id: string): void {
    const item = SchedulerStub.checkIns.find(c => c.id === id);
    if (item) {
      item.status = 'cancelled';
    }
  }
}
