let image;
let grayImage;
let thresImage;

// Upload and store image for processing
let imgElement = document.getElementById("input-image");
let inputElement = document.getElementById("file-input");

// Initial values
const lowerThresholdSlider = document.getElementById("lowerThresholdSlider");
const upperThresholdSlider = document.getElementById("upperThresholdSlider");
const thresholdTypeDropdown = document.getElementById("thresholdTypeDropdown");
const lowerThresholdLabel = document.getElementById("lowerThresholdLabel");
const upperThresholdLabel = document.getElementById("upperThresholdLabel");

// Load image and apply gray, blur and threshold
inputElement.addEventListener("change", (e) => {
    imgElement.src = URL.createObjectURL(e.target.files[0]);
}, false);

imgElement.onload = function () {
    let mat = cv.imread(imgElement);
    image = mat;

    grayImage = new cv.Mat();
    cv.cvtColor(image, grayImage, cv.COLOR_BGR2GRAY);

    thresImage = new cv.Mat();
    cv.adaptiveThreshold(grayImage, thresImage, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 61, 7);
    // cv.bitwise_not(thresImage, thresImage);

    // Fill rectangular contours
    let cts = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(thresImage, cts, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    for (let i = 0; i < cts.size(); i++) {
        let c = cts.get(i);
        let contourVector = new cv.MatVector();
        contourVector.push_back(c);
        cv.drawContours(thresImage, contourVector, -1, new cv.Scalar(255, 255, 255, 255), -1);
        c.delete();
        contourVector.delete();
    }

    // Uncomment this and comment the one below to see that filled contours
    // cv.imshow("output-image", thresImage); 

    // Morph open
    let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 7));
    let opening = new cv.Mat();
    cv.morphologyEx(thresImage, opening, cv.MORPH_OPEN, kernel, new cv.Point(-1, -1), 4);

    // Draw rectangles
    let contours = new cv.MatVector();
    cv.findContours(opening, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    for (let i = 0; i < contours.size(); i++) {
        let b = contours.get(i);
        let rect = cv.boundingRect(b);
        let point1 = new cv.Point(rect.x, rect.y);
        let point2 = new cv.Point(rect.x + rect.width, rect.y + rect.height);
        cv.rectangle(image, point1, point2, new cv.Scalar(36, 255, 12, 255), 3);
        b.delete();
    }

    // Comment out this if using the one above
    cv.imshow("output-image", image);

};

// Old stuff from here on, still using normal threshold instead of adaptive threshold.

// Apply Threshold to current image 
// Default threshold inputs are 200, 255, cv.THRESH_BINARY which is 0
function applyThreshold() {
    const lowerThresholdValue = parseInt(lowerThresholdSlider.value);
    const upperThresholdValue = parseInt(upperThresholdSlider.value);
    const thresholdType = parseInt(thresholdTypeDropdown.value);


    lowerThresholdLabel.textContent = `Lower Threshold: ${lowerThresholdValue}`;
    upperThresholdLabel.textContent = `Upper Threshold: ${upperThresholdValue}`;

    thresImage.delete();
    thresImage = new cv.Mat();
    cv.threshold(blurImage, thresImage, lowerThresholdValue, upperThresholdValue, thresholdType);
    cv.bitwise_not(thresImage, thresImage);

    cv.imshow("output-image", thresImage);
}

// Attach event listeners to handle value changes
lowerThresholdSlider.addEventListener("input", applyThreshold);
upperThresholdSlider.addEventListener("input", applyThreshold);
thresholdTypeDropdown.addEventListener("change", applyThreshold);

// Initial function call to set the initial labels
applyThreshold();

// Detect shapes
function detect() {
    // Find contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    let finalImage = image;
    cv.findContours(thresImage, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Iterate through contours
    for (let i = 0; i < contours.size(); ++i) {
        // Approximate contour
        let contour = contours.get(i);
        let area = cv.contourArea(contour);
        let perimeter = cv.arcLength(contour, true);
        let approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

        // Calculate the aspect ratio of the bounding rectangle
        let boundingRect = cv.boundingRect(contour);
        let aspectRatio = boundingRect.width / boundingRect.height;

        // console.log(`Contour ${i}: Area = ${area}, Aspect Ratio = ${aspectRatio}`);

        // Filter out small and long contours (arrows, text, etc.)
        if (area > 1000) {
            console.log(`Contour ${i}: Area = ${area}, Aspect Ratio = ${aspectRatio}`);

            // Separate arrows using dilation and erosion
            let mask = new cv.Mat(thresImage.rows, thresImage.cols, cv.CV_8UC1, new cv.Scalar(0));
            cv.drawContours(mask, contours, i, new cv.Scalar(255), cv.FILLED);

            // Tweak the kernel size and iterations for dilation and erosion
            let kernelSize = 10; // Adjust this value based on your image
            let iterations = 2; // Adjust this value based on your image
            let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelSize, kernelSize));
            cv.dilate(mask, mask, kernel, new cv.Point(-1, -1), iterations);
            cv.erode(mask, mask, kernel, new cv.Point(-1, -1), iterations);

            // Perform bitwise AND operation to separate the contour from the image
            cv.bitwise_and(thresImage, mask, mask);

            // Find the new separated contour
            let separationContours = new cv.MatVector();
            let separationHierarchy = new cv.Mat();
            cv.findContours(mask, separationContours, separationHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            console.log(`Number of Nested Contours for Contour ${i}: ${separationContours.size()}`);

            // Process each separated contour as a potential box
            for (let j = 0; j < separationContours.size(); ++j) {
                let separationContour = separationContours.get(j);
                let separationArea = cv.contourArea(separationContour);

                let separatedBoundingRect = cv.boundingRect(separationContour);
                let separatedAspectRatio = separatedBoundingRect.width / separatedBoundingRect.height;

                console.log(`Nested contour ${j}: Area = ${separationArea}, Aspect Ratio = ${separatedAspectRatio}`);

                // Determine shape based on the number of vertices in the approximated contour
                let shape = "";
                if (approx.rows === 4) {
                    shape = "C" + j;
                } else {
                    shape = "Arrow";
                }

                // Draw shape for each detected contour
                cv.drawContours(finalImage, separationContours, j, new cv.Scalar(0, 255, 0, 255), 2);
                cv.putText(finalImage, shape, new cv.Point(separationContour.data32S[0], separationContour.data32S[1]), cv.FONT_HERSHEY_SIMPLEX, 0.5, new cv.Scalar(255, 0, 0, 255), 2);

                separationContour.delete();
            }
            separationContours.delete();
            separationHierarchy.delete();

            mask.delete();
        }

        contour.delete();
        approx.delete();
    }


    cv.imshow('output-image', finalImage);

    contours.delete();
    hierarchy.delete();
}

// Helper function to calculate angle between three points
function calculateAngle(p1, p2, p3) {
    let v1 = new cv.Point(p1.x - p2.x, p1.y - p2.y);
    let v2 = new cv.Point(p3.x - p2.x, p3.y - p2.y);
    let dotProduct = v1.x * v2.x + v1.y * v2.y;
    let length1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    let length2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    let angle = Math.acos(dotProduct / (length1 * length2)) * (180 / Math.PI);
    return angle;
}