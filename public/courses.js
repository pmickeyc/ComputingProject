/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform
Computing Project (BSCCYBE4)
Due: 05/8/2024

*/

// add event listener for when the document is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    fetchUserCourses(); // fetch the courses the user is enrolled in
    fetchAllCourses(); // fetch all available courses
    // initPDFViewer(); // initialize PDF viewer if needed
});

// function to fetch user courses
function fetchUserCourses() {
    fetch('/api/my-enrolled-courses')
        .then(response => {
            if (!response.ok) {
                throw new Error('network response was not ok for fetching user courses.');
            }
            return response.json();
        })
        .then(data => {
            populateUserCourses(data);
        })
        .catch(error => {
            console.error('error fetching user courses:', error);
            document.querySelector('#my-courses').innerHTML = '<p class="text-danger">failed to load courses.</p>';
        });
}

// function to fetch all courses
function fetchAllCourses() {
    fetch('/api/all-courses')
        .then(response => {
            if (!response.ok) {
                throw new Error('network response was not ok for fetching all courses.');
            }
            return response.json();
        })
        .then(data => {
            populateAllCourses(data);
        })
        .catch(error => {
            console.error('error fetching all courses:', error);
            document.querySelector('#all-courses').innerHTML = '<p class="text-danger">failed to load courses.</p>';
        });
}

// function to populate user courses
function populateUserCourses(courses) {
    const container = document.querySelector('#my-courses');
    if (!container) {
        console.error('the container for user courses does not exist.');
        return;
    }

    if (courses.length === 0) {
        container.innerHTML = '<p>no courses found.</p>';
        return;
    }

    container.innerHTML = ''; // clear previous contents
    // iterate over user courses array
    courses.forEach(course => {
        const courseElement = document.createElement('div');
        courseElement.className = 'col-md-4';
        courseElement.innerHTML = `
            <div class="course-tile">
                <h4>${course.Title}</h4>
                <p>${course.Description}</p>
                <a href="/course/${course.CourseID}" class="btn btn-primary">go to course</a>
            </div>
        `;
        // append course element to container
        container.appendChild(courseElement);
    });
}

// function to populate all courses
function populateAllCourses(courses) {
    fetch('/api/my-enrolled-courses')
        .then(response => {
            if (!response.ok) {
                throw new Error('network response was not ok for fetching user courses.');
            }
            return response.json();
        })
        .then(enrolledCourses => {
            const enrolledCourseIds = new Set(enrolledCourses.map(course => course.CourseID));
            const container = document.querySelector('#all-courses');
            if (!container) {
                console.error('the container for all courses does not exist.');
                return;
            }

            if (courses.length === 0) {
                container.innerHTML = '<p>no courses found.</p>';
                return;
            }

            container.innerHTML = ''; // clear previous contents
            // iterate over all courses array
            courses.forEach(course => {
                const courseElement = document.createElement('div');
                courseElement.className = 'col-md-4';
                const isEnrolled = enrolledCourseIds.has(course.CourseID);
                courseElement.innerHTML = `
                    <div class="course-tile">
                        <h4>${course.Title}</h4>
                        <p>${course.Description}</p>
                        <a href="${isEnrolled ? '/course/' + course.CourseID : '#'}" class="btn btn-primary" data-course-id="${course.CourseID}">
                            ${isEnrolled ? 'go to course' : 'enroll'}
                        </a>
                    </div>
                `;
                // append course element to container
                container.appendChild(courseElement);
            });

            // add event listeners for enroll buttons
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
            console.error('error fetching enrolled courses for all courses view:', error);
            document.querySelector('#all-courses').innerHTML = '<p class="text-danger">failed to load courses.</p>';
        });
}

// function to enroll in a course
function enroll(courseId) {
    // Fetch CSRF token
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken; // Set the CSRF token value

            // Proceed with enrollment only after fetching the CSRF token
            return fetch(`/api/enroll-course/${courseId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken // Include CSRF token in the headers
                }
            });
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('network response was not ok for enrolling in course.');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert('successfully enrolled in the course!');
                fetchUserCourses();
                fetchAllCourses(); // Refresh both sections to reflect the change
            } else {
                alert('failed to enroll in the course: ' + data.message);
            }
        })
        .catch(error => {
            console.error('error enrolling in course:', error);
        });
}
