const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

function createIcon(size) {
  canvas.width = size;
  canvas.height = size;
  
  // Clear canvas
  ctx.clearRect(0, 0, size, size);
  
  // Draw red circle background
  ctx.fillStyle = '#cc0000';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw white TV shape
  ctx.fillStyle = 'white';
  const tvX = size * 0.25;
  const tvY = size * 0.25;
  const tvWidth = size * 0.5;
  const tvHeight = size * 0.5;
  
  // TV body
  ctx.beginPath();
  ctx.roundRect(tvX, tvY, tvWidth, tvHeight, [size * 0.05]);
  ctx.fill();
  
  // Draw diagonal line (block symbol)
  ctx.strokeStyle = 'white';
  ctx.lineWidth = size * 0.1;
  ctx.lineCap = 'round';
  
  ctx.beginPath();
  ctx.moveTo(size * 0.25, size * 0.25);
  ctx.lineTo(size * 0.75, size * 0.75);
  ctx.stroke();
  
  // Convert to blob and return as dataURL
  return canvas.toDataURL('image/png');
}

// Create icons
const icon16 = createIcon(16);
const icon48 = createIcon(48);
const icon128 = createIcon(128);

// Log instructions
console.log('Icons created. Right-click on each image in the page and save to your icons folder as icon16.png, icon48.png, and icon128.png');

// Add icons to page for saving
function addIconToPage(dataUrl, size) {
  const img = document.createElement('img');
  img.src = dataUrl;
  img.title = `Right-click and save as icon${size}.png`;
  img.style.margin = '10px';
  img.style.border = '1px solid #ccc';
  document.body.appendChild(img);
  
  const label = document.createElement('p');
  label.textContent = `${size}x${size} icon`;
  label.style.textAlign = 'center';
  document.body.appendChild(label);
}

// Add icons to the page
addIconToPage(icon16, 16);
addIconToPage(icon48, 48);
addIconToPage(icon128, 128);
