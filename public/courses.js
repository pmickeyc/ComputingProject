document.addEventListener('DOMContentLoaded', function () {
    fetchUserCourses();
    fetchAllCourses();
});

function fetchUserCourses() {
    // Fetch API call to get courses the user is enrolled in
    fetch('/api/my-enrolled-courses')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok for fetching user courses.');
            }
            return response.json();
        })
        .then(data => {
            populateCourses(data, '#my-courses');
        })
        .catch(error => {
            console.error('Error fetching user courses:', error);
            document.querySelector('#my-courses').innerHTML = '<p class="text-danger">Failed to load courses.</p>';
        });
}

function fetchAllCourses() {
    // Fetch API call to get all available courses
    fetch('/api/all-courses')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok for fetching all courses.');
            }
            return response.json();
        })
        .then(data => {
            populateCourses(data, '#all-courses');
        })
        .catch(error => {
            console.error('Error fetching all courses:', error);
            document.querySelector('#all-courses').innerHTML = '<p class="text-danger">Failed to load courses.</p>';
        });
}

function populateCourses(courses, containerSelector) {
    const container = document.querySelector(containerSelector);
    console.log(container);  // Debug: Log the container to see if it's null

    if (!container) {
        console.error('The container with selector ' + containerSelector + ' does not exist.');
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