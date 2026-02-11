/**
 * AWS Chime SDK - Crear reunión y asistentes.
 * El frontend usará amazon-chime-sdk-js para unirse con los tokens.
 */

import {
  ChimeSDKMeetingsClient,
  CreateMeetingCommand,
  CreateAttendeeCommand,
  DeleteMeetingCommand,
} from '@aws-sdk/client-chime-sdk-meetings';
import { v4 as uuidv4 } from 'uuid';

const region = process.env.AWS_REGION || 'us-east-1';
const client = new ChimeSDKMeetingsClient({ region });

/** Cache en memoria para que quien se una pueda obtener la meeting (POC). */
const meetingCache = new Map<string, ChimeMeetingInfo>();

export interface ChimeMeetingInfo {
  meetingId: string;
  mediaPlacement: {
    audioHostUrl: string;
    audioFallbackUrl: string;
    signalingUrl: string;
    turnControlUrl: string;
  };
  mediaRegion: string;
}

export interface ChimeAttendeeInfo {
  attendeeId: string;
  joinToken: string;
  externalUserId?: string;
}

export interface CreateMeetingResult {
  meeting: ChimeMeetingInfo;
  meetingId: string;
  externalMeetingId: string;
}

export async function createMeeting(externalId?: string): Promise<CreateMeetingResult> {
  const externalMeetingId = externalId || `video-consulta-${uuidv4()}`;
  const result = await client.send(
    new CreateMeetingCommand({
      ClientRequestToken: uuidv4(),
      MediaRegion: region,
      ExternalMeetingId: externalMeetingId,
    })
  );

  const meeting = result.Meeting;
  if (!meeting?.MeetingId || !meeting.MediaPlacement) {
    throw new Error('Chime CreateMeeting returned invalid response');
  }

  const meetingInfo: ChimeMeetingInfo = {
    meetingId: meeting.MeetingId,
    mediaPlacement: {
      audioHostUrl: meeting.MediaPlacement.AudioHostUrl || '',
      audioFallbackUrl: meeting.MediaPlacement.AudioFallbackUrl || '',
      signalingUrl: meeting.MediaPlacement.SignalingUrl || '',
      turnControlUrl: meeting.MediaPlacement.TurnControlUrl || '',
    },
    mediaRegion: meeting.MediaRegion || region,
  };
  meetingCache.set(meeting.MeetingId, meetingInfo);
  return {
    meetingId: meeting.MeetingId,
    externalMeetingId,
    meeting: meetingInfo,
  };
}

export function getMeeting(meetingId: string): ChimeMeetingInfo | null {
  return meetingCache.get(meetingId) ?? null;
}

export async function createAttendee(
  meetingId: string,
  externalUserId: string
): Promise<ChimeAttendeeInfo> {
  const result = await client.send(
    new CreateAttendeeCommand({
      MeetingId: meetingId,
      ExternalUserId: externalUserId,
    })
  );

  const att = result.Attendee;
  if (!att?.AttendeeId || !att.JoinToken) {
    throw new Error('Chime CreateAttendee returned invalid response');
  }

  return {
    attendeeId: att.AttendeeId,
    joinToken: att.JoinToken,
    externalUserId: externalUserId,
  };
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  await client.send(new DeleteMeetingCommand({ MeetingId: meetingId }));
}
