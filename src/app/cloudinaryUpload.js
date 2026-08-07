// cloudinaryUpload.js
//
// Uploads a photo and/or video to Cloudinary (free tier, no card required)
// and returns a public HTTPS URL. Kept as its own file on purpose: when
// your organization gives you their own storage system later, you only
// need to change what's inside these two functions — nothing else in the
// app has to change.
//
// SETUP (one-time, free, no card):
// 1. Sign up at cloudinary.com
// 2. Your "Cloud Name" is shown right on the dashboard after signup — copy it below.
// 3. Go to Settings (gear icon) -> Upload -> scroll to "Upload presets" -> "Add upload preset"
// 4. Set "Signing Mode" to "Unsigned", save, and copy the preset name below.

const CLOUDINARY_CLOUD_NAME = 'wip9rgta';
const CLOUDINARY_UPLOAD_PRESET = 'polehazard';

export async function uploadImageToCloudinary(base64Data, mimeType) {
  const formData = new FormData();
  formData.append('file', `data:${mimeType};base64,${base64Data}`);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Image upload failed');
  return data.secure_url;
}

export async function uploadVideoToCloudinary(videoUri) {
  const formData = new FormData();
  // React Native's FormData understands this {uri, type, name} shape for files —
  // it streams straight from the local file instead of loading it into memory.
  formData.append('file', { uri: videoUri, type: 'video/mp4', name: 'evidence.mp4' });
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Video upload failed');
  return data.secure_url;
}