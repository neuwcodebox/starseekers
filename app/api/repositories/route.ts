import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { fetchStarredRepositories } from '../../lib/github';
import { authOptions } from '../auth/[...nextauth]/options';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: 'Sign-in required.' }, { status: 401 });
  }

  const repos = await fetchStarredRepositories(session.user.accessToken);
  return NextResponse.json({ repos });
}
