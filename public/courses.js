document.addEventListener('DOMContentLoaded', function () {
    fetchUserCourses();
    fetchAllCourses();
    // initPDFViewer();
});

function fetchUserCourses() {
    fetch('/api/my-enrolled-courses')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok for fetching user courses.');
            }
            return response.json();
        })
        .then(data => {
            populateUserCourses(data);
        })
        .catch(error => {
            console.error('Error fetching user courses:', error);
            document.querySelector('#my-courses').innerHTML = '<p class="text-danger">Failed to load courses.</p>';
        });
}

function fetchAllCourses() {
    fetch('/api/all-courses')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok for fetching all courses.');
            }
            return response.json();
        })
        .then(data => {
            populateAllCourses(data);
        })
        .catch(error => {
            console.error('Error fetching all courses:', error);
            document.querySelector('#all-courses').innerHTML = '<p class="text-danger">Failed to load courses.</p>';
        });
}

function populateUserCourses(courses) {
    const container = document.querySelector('#my-courses');
    if (!container) {
        console.error('The container for user courses does not exist.');
        return;
    }

    if (courses.length === 0) {
        container.innerHTML = '<p>No courses found.</p>';
        return;
    }

    container.innerHTML = ''; // Clear previous contents
    courses.forEach(course => {
        const courseElement = document.createElement('div');
        courseElement.className = 'col-md-4';
        courseElement.innerHTML = `
            <div class="course-tile">
                <h4>${course.Title}</h4>
                <p>${course.Description}</p>
                <a href="/course/${course.CourseID}" class="btn btn-primary">Go to Course</a>
            </div>
        `;
        container.appendChild(courseElement);
    });
}

function populateAllCourses(courses) {
    fetch('/api/my-enrolled-courses')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok for fetching user courses.');
            }
            return response.json();
        })
        .then(enrolledCourses => {
            const enrolledCourseIds = new Set(enrolledCourses.map(course => course.CourseID));
            const container = document.querySelector('#all-courses');
            if (!container) {
                console.error('The container for all courses does not exist.');
                return;
            }

            if (courses.length === 0) {
                container.innerHTML = '<p>No courses found.</p>';
                return;
            }

            container.innerHTML = ''; // Clear previous contents
            courses.forEach(course => {
                const courseElement = document.createElement('div');
                courseElement.className = 'col-md-4';
                const isEnrolled = enrolledCourseIds.has(course.CourseID);
                courseElement.innerHTML = `
                    <div class="course-tile">
                        <h4>${course.Title}</h4>
                        <p>${course.Description}</p>
                        <a href="${isEnrolled ? '/course/' + course.CourseID : '#'}" class="btn btn-primary" data-course-id="${course.CourseID}">
                            ${isEnrolled ? 'Go to Course' : 'Enroll'}
                        </a>
                    </div>
                `;
                container.appendChild(courseElement);
            });

            // Add event listeners for enroll buttons
            container.querySelectorAll('a.btn-primary').forEach(button => {
                if (!button.href.includes('/course/')) {
                    button.addEventListener('click', function (event) {
                        event.preventDefault();
                        const courseId = button.getAttribute('data-course-id');
                        enroll(courseId);
                    });
                }
            });
        })
        .catch(error => {
            console.error('Error fetching enrolled courses for all courses view:', error);
            document.querySelector('#all-courses').innerHTML = '<p class="text-danger">Failed to load courses.</p>';
        });
}

function enroll(courseId) {
    fetch(`/api/enroll-course/${courseId}`, {
        method: 'POST'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok for enrolling in course.');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert('Successfully enrolled in the course!');
            fetchUserCourses();
            fetchAllCourses(); // Refresh both sections to reflect the change
        } else {
            alert('Failed to enroll in the course: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error enrolling in course:', error);
    });
}

// let pdfDoc = null,
//     pageNum = 1,
//     pageRendering = false,
//     pageNumPending = null,
//     scale = 1.5,
//     canvas = document.getElementById('pdf-canvas'),
//     ctx = canvas.getContext('2d');

// function initPDFViewer() {
//     document.getElementById('prev').addEventListener('click', onPrevPage);
//     document.getElementById('next').addEventListener('click', onNextPage);

//     // Load the initial PDF (assuming the URL is provided in the global context or passed as a parameter)
//     const urlPath = window.location.pathname;
//     const courseId = urlPath.substring(urlPath.lastIndexOf('/') + 1);
//     $.ajax({
//         url: `/files/pdf/${courseId}`,
//         method: 'GET',
//         xhrFields: {
//             responseType: 'blob' // Set response type as blob
//         },
//         success: function (blob) {
//             const pdfUrl = URL.createObjectURL(blob);
//             loadPDF(pdfUrl);
//         },
//         error: function (xhr, status, error) {
//             console.error("Failed to retrieve PDF:", status, error);
//             alert('Failed to retrieve PDF URL.');
//         }
//     });
// }

// // Load PDF document
// function loadPDF(url) {
//     pdfjsLib.getDocument(url).promise.then(function (pdfDoc_) {
//         pdfDoc = pdfDoc_;
//         document.getElementById('page_count').textContent = pdfDoc.numPages;
//         renderPage(pageNum);
//     });
// }

// // Render the page
// function renderPage(num) {
//     pageRendering = true;
//     pdfDoc.getPage(num).then(function (page) {
//         var viewport = page.getViewport({ scale: scale });
//         canvas.height = viewport.height;
//         canvas.width = viewport.width;

//         var renderContext = {
//             canvasContext: ctx,
//             viewport: viewport
//         };
//         var renderTask = page.render(renderContext);

//         renderTask.promise.then(function () {
//             pageRendering = false;
//             if (pageNumPending !== null) {
//                 renderPage(pageNumPending);
//                 pageNumPending = null;
//             }
//         });
//     });

//     document.getElementById('page_num').textContent = num;
// }

// // Go to previous page
// function onPrevPage() {
//     if (pageNum <= 1) {
//         return;
//     }
//     pageNum--;
//     renderPage(pageNum);
// }

// // Go to next page
// function onNextPage() {
//     if (pageNum >= pdfDoc.numPages) {
//         return;
//     }
//     pageNum++;
//     renderPage(pageNum);
// }

