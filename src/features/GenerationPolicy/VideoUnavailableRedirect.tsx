import { Navigate } from 'react-router';

// Resolve relative to the video route to retain any workspace prefix, while
// discarding video-specific model/topic query parameters.
export const VideoUnavailableRedirect = () => <Navigate replace to={'../image'} />;
