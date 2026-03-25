import { useState, useEffect } from 'react';
import { X, Upload, User, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentsAPI } from '../../services/api';

const AddStudentModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    rollNumber: '',
    section: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: 'Male',
    attendance: 100,
    academicScore: 0,
    address: {
      street: '',
      city: '',
      state: '',
      pincode: ''
    },
    father: {
      name: '',
      phone: '',
      email: '',
      occupation: ''
    },
    mother: {
      name: '',
      phone: '',
      email: '',
      occupation: ''
    }
  });

  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generatingRollNumber, setGeneratingRollNumber] = useState(false);

  // Auto-generate roll number when class/section changes (only if roll number is empty)
  useEffect(() => {
    if (formData.section && isOpen && !formData.rollNumber) {
      generateRollNumber(false);
    }
  }, [formData.section, isOpen]);

  const generateRollNumber = async (showToast = true) => {
    if (!formData.section) {
      if (showToast) {
        toast.error('Please select a class/section first');
      }
      return;
    }

    setGeneratingRollNumber(true);
    try {
      const response = await studentsAPI.getNextRollNumber(formData.section);
      const nextRollNumber = response.data.data.nextRollNumber;
      
      setFormData(prev => ({
        ...prev,
        rollNumber: nextRollNumber
      }));
      
      if (showToast) {
        toast.success(`Roll number ${nextRollNumber} assigned`);
      }
    } catch (error) {
      console.error('Error generating roll number:', error);
      if (showToast) {
        toast.error('Failed to generate roll number');
      }
    } finally {
      setGeneratingRollNumber(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }

      setImageFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.rollNumber) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.section) {
      toast.error('Please select class/section');
      return;
    }

    if (!formData.father.name || !formData.father.phone) {
      toast.error('Please provide father details');
      return;
    }

    if (!formData.mother.name || !formData.mother.phone) {
      toast.error('Please provide mother details');
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        ...formData,
        photo: imagePreview
      };

      await onSubmit(submitData);
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        rollNumber: '',
        section: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        gender: 'Male',
        attendance: 100,
        academicScore: 0,
        address: {
          street: '',
          city: '',
          state: '',
          pincode: ''
        },
        father: {
          name: '',
          phone: '',
          email: '',
          occupation: ''
        },
        mother: {
          name: '',
          phone: '',
          email: '',
          occupation: ''
        }
      });
      setImagePreview(null);
      setImageFile(null);
      
      onClose();
    } catch (error) {
      console.error('Error submitting:', error);
      // Check for duplicate roll number error
      if (error.response?.data?.message?.includes('rollNumber') || 
          error.response?.data?.message?.includes('duplicate') ||
          error.response?.data?.message?.includes('E11000')) {
        toast.error('This roll number is already assigned to another student. Please use a different roll number.');
      }
      // Error is already handled in the parent component, but we can add specific handling here
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900">Add New Student</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Profile Photo */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Photo
              </label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-300">
                      <User className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="btn-outline cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-1">Max 5MB. JPG, PNG accepted.</p>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="Enter last name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Roll Number <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 ml-2">(Auto-generated, editable)</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        name="rollNumber"
                        value={formData.rollNumber}
                        onChange={handleInputChange}
                        className="input"
                        placeholder="Select class first or enter manually"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={generateRollNumber}
                      disabled={!formData.section || generatingRollNumber}
                      className="btn-outline flex items-center gap-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Regenerate roll number"
                    >
                      <RefreshCw className={`w-4 h-4 ${generatingRollNumber ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Auto-assigned when class is selected. You can edit or regenerate it.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="input"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Class/Section <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="section"
                    value={formData.section}
                    onChange={handleInputChange}
                    className="input"
                  >
                    <option value="">Select class</option>
                    <option value="9A">9A</option>
                    <option value="9B">9B</option>
                    <option value="10A">10A</option>
                    <option value="10B">10B</option>
                    <option value="11A">11A</option>
                    <option value="11B">11B</option>
                  </select>
                </div>



                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="Enter email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="Enter phone"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Address</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <input type="text" name="address.street" value={formData.address.street} onChange={handleInputChange} className="input" placeholder="Street" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input type="text" name="address.city" value={formData.address.city} onChange={handleInputChange} className="input" placeholder="City" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input type="text" name="address.state" value={formData.address.state} onChange={handleInputChange} className="input" placeholder="State" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <input type="text" name="address.pincode" value={formData.address.pincode} onChange={handleInputChange} className="input" placeholder="Pincode" />
                </div>
              </div>
            </div>

            {/* Father Details */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Father Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name <span className="text-red-500">*</span></label>
                  <input type="text" name="father.name" value={formData.father.name} onChange={handleInputChange} className="input" placeholder="Father's name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Father's Phone <span className="text-red-500">*</span></label>
                  <input type="tel" name="father.phone" value={formData.father.phone} onChange={handleInputChange} className="input" placeholder="Father's phone" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Father's Email</label>
                  <input type="email" name="father.email" value={formData.father.email} onChange={handleInputChange} className="input" placeholder="Father's email" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Father's Occupation</label>
                  <input type="text" name="father.occupation" value={formData.father.occupation} onChange={handleInputChange} className="input" placeholder="Occupation" />
                </div>
              </div>
            </div>

            {/* Mother Details */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Mother Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mother's Name <span className="text-red-500">*</span></label>
                  <input type="text" name="mother.name" value={formData.mother.name} onChange={handleInputChange} className="input" placeholder="Mother's name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mother's Phone <span className="text-red-500">*</span></label>
                  <input type="tel" name="mother.phone" value={formData.mother.phone} onChange={handleInputChange} className="input" placeholder="Mother's phone" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mother's Email</label>
                  <input type="email" name="mother.email" value={formData.mother.email} onChange={handleInputChange} className="input" placeholder="Mother's email" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mother's Occupation</label>
                  <input type="text" name="mother.occupation" value={formData.mother.occupation} onChange={handleInputChange} className="input" placeholder="Occupation" />
                </div>
              </div>
            </div>

            {/* Academic Information */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Academic Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Attendance (%)
                  </label>
                  <input
                    type="number"
                    name="attendance"
                    value={formData.attendance || 100}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="Enter attendance percentage"
                    min="0"
                    max="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank for 100% (new student)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Academic Score (%)
                  </label>
                  <input
                    type="number"
                    name="academicScore"
                    value={formData.academicScore || 0}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="Enter academic percentage"
                    min="0"
                    max="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank for 0% (will be updated by teachers)</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button type="button" onClick={onClose} className="btn-outline" disabled={loading}>Cancel</button>
              <button onClick={handleSubmit} className="btn-primary" disabled={loading}>{loading ? 'Adding...' : 'Add Student'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddStudentModal;