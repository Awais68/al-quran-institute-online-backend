import axios from 'axios';
import colors from 'colors';

const BASE_URL = 'http://localhost:4000';
let authToken = '';
let testStudentId = '';
let testTeacherId = '';

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to log test results
function logTest(name, passed, error = null) {
  results.tests.push({ name, passed, error });
  if (passed) {
    results.passed++;
    console.log(colors.green(`✓ ${name}`));
  } else {
    results.failed++;
    console.log(colors.red(`✗ ${name}`));
    if (error) console.log(colors.red(`  Error: ${error}`));
  }
}

// Helper function to make authenticated requests
async function authenticatedRequest(method, url, data = null) {
  const config = {
    method,
    url: `${BASE_URL}${url}`,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    data
  };
  return axios(config);
}

// Test 1: Server Health Check
async function testServerHealth() {
  try {
    const response = await axios.get(`${BASE_URL}/`);
    logTest('Server Health Check', response.status === 200);
  } catch (error) {
    logTest('Server Health Check', false, error.message);
  }
}

// Test 2: User Registration (Student)
async function testStudentRegistration() {
  try {
    const studentData = {
      name: 'Test Student',
      email: `teststudent${Date.now()}@test.com`,
      password: 'Test@123',
      phone: '1234567890',
      gender: 'male',
      country: 'Pakistan',
      city: 'Karachi',
      role: 'Student',
      fatherName: 'Test Father',
      dob: new Date('2010-01-01'),
      age: 14,
      app: 'WhatsApp',
      suitableTime: '6:00 AM - 8:00 AM',
      course: 'Qaida',
      classDays: ['Monday', 'Wednesday', 'Friday'],
      image: 'https://via.placeholder.com/150'
    };

    const response = await axios.post(`${BASE_URL}/auth/signup`, studentData);
    
    if (response.status === 201 && response.data.data && response.data.data.user) {
      testStudentId = response.data.data.user._id;
      logTest('Student Registration', true);
    } else {
      logTest('Student Registration', false, 'Invalid response structure');
    }
  } catch (error) {
    logTest('Student Registration', false, error.response?.data?.msg || error.message);
  }
}

// Test 3: User Registration (Teacher)
async function testTeacherRegistration() {
  try {
    const teacherEmail = `testteacher${Date.now()}@test.com`;
    const teacherData = {
      name: 'Test Teacher',
      email: teacherEmail,
      password: 'Test@123',
      phone: '9876543210',
      gender: 'female',
      country: 'Pakistan',
      city: 'Lahore',
      role: 'Teacher',
      qualification: 'Masters in Islamic Studies',
      experience: '5 years',
      expertise: 'Tajweed, Hifz',
      bio: 'Experienced Quran teacher',
      image: 'https://via.placeholder.com/150'
    };

    const response = await axios.post(`${BASE_URL}/auth/signup`, teacherData);
    
    if (response.status === 201 && response.data.data && response.data.data.user) {
      testTeacherId = response.data.data.user._id;
      // Store teacher credentials for login
      global.teacherEmail = teacherEmail;
      global.teacherPassword = 'Test@123';
      logTest('Teacher Registration', true);
    } else {
      logTest('Teacher Registration', false, 'Invalid response structure');
    }
  } catch (error) {
    logTest('Teacher Registration', false, error.response?.data?.msg || error.message);
  }
}

// Test 4: Login
async function testLogin(email, password) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password
    });

    if (response.status === 200 && response.data.data && response.data.data.token) {
      authToken = response.data.data.token;
      logTest('Teacher Login', true);
      return true;
    } else {
      logTest('Teacher Login', false, 'No token received in response.data.data.token');
      return false;
    }
  } catch (error) {
    logTest('Teacher Login', false, error.response?.data?.msg || error.message);
    return false;
  }
}

// Test 5: Get Current User
async function testGetCurrentUser() {
  try {
    const response = await authenticatedRequest('GET', '/getCurrentUser/getCurrentUser');
    
    if (response.status === 200 && response.data.data) {
      logTest('Get Current User', true);
    } else {
      logTest('Get Current User', false, 'Invalid response');
    }
  } catch (error) {
    logTest('Get Current User', false, error.response?.data?.msg || error.message);
  }
}

// Test 6: Get All Students
async function testGetAllStudents() {
  try {
    const response = await authenticatedRequest('GET', '/students/getAllStudents');
    
    if (response.status === 200 && response.data.data && response.data.data.students) {
      logTest('Get All Students', true);
    } else {
      logTest('Get All Students', false, 'Invalid response format');
    }
  } catch (error) {
    logTest('Get All Students', false, error.response?.data?.msg || error.message);
  }
}

// Test 7: Update Student Instructions (Teacher)
async function testUpdateInstructions() {
  try {
    if (!testStudentId) {
      logTest('Update Student Instructions', false, 'No test student ID available');
      return;
    }

    const response = await authenticatedRequest(
      'PATCH',
      `/user/students/${testStudentId}/instructions`,
      {
        teacherInstructions: 'Please focus on memorizing Surah Al-Fatiha and practice daily.'
      }
    );

    if (response.status === 200) {
      logTest('Update Student Instructions', true);
    } else {
      logTest('Update Student Instructions', false, 'Invalid response');
    }
  } catch (error) {
    logTest('Update Student Instructions', false, error.response?.data?.msg || error.message);
  }
}

// Test 8: Verify Instructions Were Saved
async function testVerifyInstructions() {
  try {
    if (!testStudentId) {
      logTest('Verify Instructions Saved', false, 'No test student ID available');
      return;
    }

    const response = await authenticatedRequest('GET', `/studentById/getAStudent/${testStudentId}`);
    
    if (response.status === 200 && response.data.data) {
      const student = response.data.data;
      if (student.teacherInstructions) {
        logTest('Verify Instructions Saved', true);
      } else {
        logTest('Verify Instructions Saved', false, 'Instructions not found in student data');
      }
    } else {
      logTest('Verify Instructions Saved', false, 'Could not retrieve student data');
    }
  } catch (error) {
    logTest('Verify Instructions Saved', false, error.response?.data?.msg || error.message);
  }
}

// Test 9: Invalid Email Format
async function testInvalidEmailRegistration() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/signup`, {
      name: 'Test User',
      email: 'invalidemail',
      password: 'Test@123',
      phone: '1234567890',
      gender: 'male',
      country: 'Pakistan',
      role: 'Student',
      fatherName: 'Test Father',
      dob: new Date('2010-01-01'),
      age: 14,
      app: 'WhatsApp',
      suitableTime: '6:00 AM - 8:00 AM',
      course: 'Qaida'
    });
    logTest('Invalid Email Validation', false, 'Should have rejected invalid email');
  } catch (error) {
    if (error.response?.status === 400) {
      logTest('Invalid Email Validation', true);
    } else {
      logTest('Invalid Email Validation', false, error.message);
    }
  }
}

// Test 10: Weak Password
async function testWeakPassword() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/signup`, {
      name: 'Test User',
      email: `test${Date.now()}@test.com`,
      password: 'weak',
      phone: '1234567890',
      gender: 'male',
      country: 'Pakistan',
      role: 'Student',
      fatherName: 'Test Father',
      dob: new Date('2010-01-01'),
      age: 14,
      app: 'WhatsApp',
      suitableTime: '6:00 AM - 8:00 AM',
      course: 'Qaida'
    });
    logTest('Weak Password Validation', false, 'Should have rejected weak password');
  } catch (error) {
    if (error.response?.status === 400) {
      logTest('Weak Password Validation', true);
    } else {
      logTest('Weak Password Validation', false, error.message);
    }
  }
}

// Test 11: Duplicate Email Registration
async function testDuplicateEmail() {
  try {
    const email = `duplicate${Date.now()}@test.com`;
    
    // First registration
    await axios.post(`${BASE_URL}/auth/signup`, {
      name: 'First User',
      email: email,
      password: 'Test@123',
      phone: '1234567890',
      gender: 'male',
      country: 'Pakistan',
      role: 'Teacher',
      qualification: 'Masters',
      experience: '5 years',
      expertise: 'Tajweed',
      image: 'https://via.placeholder.com/150'
    });

    // Try duplicate registration
    await axios.post(`${BASE_URL}/auth/signup`, {
      name: 'Second User',
      email: email,
      password: 'Test@123',
      phone: '9876543210',
      gender: 'female',
      country: 'Pakistan',
      role: 'Teacher',
      qualification: 'Masters',
      experience: '3 years',
      expertise: 'Hifz',
      image: 'https://via.placeholder.com/150'
    });
    
    logTest('Duplicate Email Prevention', false, 'Should have rejected duplicate email');
  } catch (error) {
    if (error.response?.status === 409) {
      logTest('Duplicate Email Prevention', true);
    } else {
      logTest('Duplicate Email Prevention', false, error.message);
    }
  }
}

// Test 12: Unauthorized Access to Instructions
async function testUnauthorizedInstructionsUpdate() {
  try {
    // Try to update without authentication
    const response = await axios.patch(
      `${BASE_URL}/user/students/${testStudentId}/instructions`,
      { teacherInstructions: 'Unauthorized update' }
    );
    logTest('Unauthorized Instructions Update Prevention', false, 'Should have rejected unauthorized request');
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      logTest('Unauthorized Instructions Update Prevention', true);
    } else {
      logTest('Unauthorized Instructions Update Prevention', false, error.message);
    }
  }
}

// Run all tests
async function runAllTests() {
  console.log(colors.bold.cyan('\n🧪 Starting API Tests...\n'));
  console.log(colors.yellow('=' .repeat(60)));

  // Basic tests
  await testServerHealth();
  
  // Registration tests
  await testStudentRegistration();
  await testTeacherRegistration();
  
  // Validation tests
  await testInvalidEmailRegistration();
  await testWeakPassword();
  await testDuplicateEmail();

  // Authenticated tests
  if (global.teacherEmail && global.teacherPassword) {
    const loginSuccess = await testLogin(global.teacherEmail, global.teacherPassword);
    if (loginSuccess) {
      await testGetCurrentUser();
      await testGetAllStudents();
      await testUpdateInstructions();
      await testVerifyInstructions();
    }
  }

  // Unauthorized access test
  await testUnauthorizedInstructionsUpdate();

  // Summary
  console.log(colors.yellow('\n' + '='.repeat(60)));
  console.log(colors.bold.cyan('\n📊 Test Summary:\n'));
  console.log(colors.green(`✓ Passed: ${results.passed}`));
  console.log(colors.red(`✗ Failed: ${results.failed}`));
  console.log(colors.cyan(`Total: ${results.passed + results.failed}\n`));

  if (results.failed > 0) {
    console.log(colors.red('Failed Tests:'));
    results.tests.filter(t => !t.passed).forEach(t => {
      console.log(colors.red(`  - ${t.name}: ${t.error}`));
    });
  }

  console.log(colors.yellow('=' .repeat(60) + '\n'));

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error(colors.red('Test suite failed:'), error);
  process.exit(1);
});
