let image;
let grayImage;
let blurImage;
let thresImage;
let finalImage;

// Upload and store image for processing
let imgElement = document.getElementById("input-image");
let inputElement = document.getElementById("file-input");

inputElement.addEventListener("change", (e) => {
    imgElement.src = URL.createObjectURL(e.target.files[0]);
}, false);

imgElement.onload = function () {
    let mat = cv.imread(imgElement);
    image = mat;
    finalImage = mat;
    cv.imshow("output-image", mat);

    gray.delete();
    thresh.delete();
};

// Convert to grayscale
function convertGrayscale() {
    grayImage = new cv.Mat();
    cv.cvtColor(image, grayImage, cv.COLOR_BGR2GRAY);
    cv.imshow("output-image", grayImage);
}

// Apply Gaussian blur to reduce noise
function applyBlur() {
    blurImage = new cv.Mat();
    cv.GaussianBlur(grayImage, blurImage, new cv.Size(5, 5), 0);
    cv.imshow("output-image", blurImage);

    console.log(blurImage); //DELETE
}

// Apply Threshold to further reduce noise
function applyThreshold() {
    thresImage = new cv.Mat();
    cv.threshold(blurImage, thresImage, 200, 255, cv.THRESH_BINARY);
    cv.bitwise_not(thresImage, thresImage);
    cv.imshow("output-image", thresImage);
}

// Detect shapes
function detect() {
    // Find contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(thresImage, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Iterate through contours
    for (let i = 0; i < contours.size(); ++i) {

        console.log(contours.size() + "Shapes")

        // Approximate contour
        let contour = contours.get(i);
        let epsilon = 0.01 * cv.arcLength(contour, true);
        let approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, epsilon, true);

        // Determine shape
        let shape;
        if (approx.rows == 3) {
            shape = "Triangle";
        } else if (approx.rows == 4) {
            let rect = cv.boundingRect(contour);
            let width = rect.width;
            let height = rect.height;

            // Check if square or rectangle
            let ratio = width / height;
            if (Math.abs(ratio - 1) < 0.1) {
                shape = "Square";
            } else {
                shape = "Rectangle";
            }
        } else if (approx.rows == 5) {
            shape = "Pentagon";
        } else {
            let ellipse = cv.fitEllipse(contour);
            let aspectRatio = ellipse.size.width / ellipse.size.height;
            if (aspectRatio >= 0.9 && aspectRatio <= 1.1) {
                shape = "Circle";
            } else {
                shape = "Oval";
            }
        }

        // Draw shape
        cv.drawContours(finalImage, contours, i, new cv.Scalar(0, 255, 0, 255), 2);
        cv.putText(finalImage, shape, new cv.Point(contour.data32S[0], contour.data32S[1]), cv.FONT_HERSHEY_SIMPLEX, 0.5, new cv.Scalar(255, 0, 0, 255), 2);

        contour.delete();
        approx.delete();
    }

    cv.imshow('output-image', finalImage);

    contours.delete();
    hierarchy.delete();
}