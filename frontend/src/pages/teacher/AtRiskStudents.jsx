import { useState } from 'react'
import { useQuery } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { 
  AlertTriangle, 
  Users, 
  TrendingDown, 
  Calendar,
  Phone,
  Mail,
  MessageSquare,
  Eye,
  Plus,
  X,
  Send
} from 'lucide-react'
import { teacherAPI } from '../../services/api'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import toast from 'react-hot-toast'
import { useSocket } from '../../contexts/SocketContext'

const AtRiskStudents = () => {
  const navigate = useNavigate()
  const [selectedRiskLevel, setSelectedRiskLevel] = useState('All')
  const [selectedClass, setSelectedClass] = useState('All')
  const [showSendMessageModal, setShowSendMessageModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [messageData, setMessageData] = useState({
    subject: '',
    message: '',
    type: 'Urgent',
    priority: 'High'
  })
  const { socket } = useSocket()

  // Get at-risk students
  const { data: studentsData, isLoading, error, refetch } = useQuery(
    'at-risk-students',
    () => teacherAPI.getAtRiskStudents(),
    {
      staleTime: 30000,
    }
  )

  // Get dashboard data for class filter
  const { data: dashboardData } = useQuery(
    'teacher-dashboard',
    () => teacherAPI.getDashboard(),
    {
      staleTime: 30000,
    }
  )

  // Extract data properly from Axios response wrapper
  const students = studentsData?.data?.data?.students || studentsData?.data?.students || []
  const dashboard = dashboardData?.data?.data || dashboardData?.data || {}
  const { assignedClasses = [] } = dashboard

  // Filter students
  const filteredStudents = students.filter(student => {
    const riskMatch = selectedRiskLevel === 'All' || student.riskLevel === selectedRiskLevel
    const classMatch = selectedClass === 'All' || student.section === selectedClass
    return riskMatch && classMatch
  })

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'Critical':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'High':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getRiskIcon = (riskLevel) => {
    switch (riskLevel) {
      case 'Critical':
        return <AlertTriangle className="w-4 h-4 text-purple-600" />
      case 'High':
        return <AlertTriangle className="w-4 h-4 text-red-600" />
      case 'Medium':
        return <TrendingDown className="w-4 h-4 text-yellow-600" />
      default:
        return <Users className="w-4 h-4 text-gray-600" />
    }
  }

  const handleContactParent = (student, method) => {
    if (method === 'Message') {
      setSelectedStudent(student)
      setShowSendMessageModal(true)
    } else {
      toast.success(`Contacting ${student.firstName}'s parent via ${method}`)
    }
  }

  const handleAddObservation = (student) => {
    toast.success(`Adding observation for ${student.firstName} ${student.lastName}`)
  }

  const handleViewProfile = (student) => {
    navigate(`/teacher/students/${student._id || student.id}`)
  }

  if (isLoading) return <LoadingSpinner className="h-64" />

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Failed to load at-risk students</h3>
          <button onClick={() => refetch()} className="mt-2 btn-primary">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">At-Risk Students</h1>
        <p className="text-gray-600">Monitor and support students who need immediate attention</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total At-Risk</p>
              <p className="text-2xl font-bold text-red-600">{students.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical</p>
              <p className="text-2xl font-bold text-purple-600">
                {students.filter(s => s.riskLevel === 'Critical').length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">High Risk</p>
              <p className="text-2xl font-bold text-red-600">
                {students.filter(s => s.riskLevel === 'High').length}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Medium Risk</p>
              <p className="text-2xl font-bold text-yellow-600">
                {students.filter(s => s.riskLevel === 'Medium').length}
              </p>
            </div>
            <Users className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Risk Level
            </label>
            <select
              value={selectedRiskLevel}
              onChange={(e) => setSelectedRiskLevel(e.target.value)}
              className="input"
            >
              <option value="All">All Risk Levels</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="input"
            >
              <option value="All">All Classes</option>
              {assignedClasses.map((classData) => (
                <option key={classData.className} value={classData.className}>
                  Class {classData.className}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              At-Risk Students ({filteredStudents.length})
            </h3>
            <div className="text-sm text-gray-500">
              Showing {filteredStudents.length} of {students.length} students
            </div>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No at-risk students found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {selectedRiskLevel !== 'All' || selectedClass !== 'All' 
                ? 'Try adjusting your filters.' 
                : 'Great! All your students are doing well.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredStudents.map((student) => (
              <div key={student.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {getRiskIcon(student.riskLevel)}
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">
                          {student.firstName} {student.lastName}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Class {student.section} • Roll No: {student.rollNumber}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRiskColor(student.riskLevel)}`}>
                        {student.riskLevel} Risk
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Attendance</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${student.attendancePercentage || 0}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {student.attendancePercentage || 0}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Academic Performance</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-purple-600 h-2 rounded-full"
                              style={{ width: `${student.overallPercentage || 0}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {student.overallPercentage || 0}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Risk Score</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-red-600 h-2 rounded-full"
                              style={{ width: `${student.riskScore || 0}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-red-600">
                            {student.riskScore || 0}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Recent Observations */}
                    {student.recentObservations && student.recentObservations.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Recent Observations:</p>
                        <div className="space-y-1">
                          {student.recentObservations.slice(0, 2).map((obs, idx) => (
                            <div key={idx} className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                              <span className="font-medium">{obs.type}:</span> {obs.title}
                              <span className="text-xs text-gray-500 ml-2">
                                ({new Date(obs.date).toLocaleDateString()})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 ml-6">
                    <button
                      onClick={() => handleViewProfile(student)}
                      className="btn-outline flex items-center gap-2 text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      View Profile
                    </button>
                    <button
                      onClick={() => handleAddObservation(student)}
                      className="btn-outline flex items-center gap-2 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add Note
                    </button>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleContactParent(student, 'SMS')}
                        className="btn-outline p-2"
                        title="Send SMS"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleContactParent(student, 'Email')}
                        className="btn-outline p-2"
                        title="Send Email"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleContactParent(student, 'Message')}
                        className="btn-outline p-2"
                        title="Send Message"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send Message to Parent Modal */}
      {showSendMessageModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Send Message to Parent - {selectedStudent.firstName} {selectedStudent.lastName}
              </h3>
              <button
                onClick={() => {
                  setShowSendMessageModal(false)
                  setMessageData({ subject: '', message: '', type: 'Urgent', priority: 'High' })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Student:</strong> {selectedStudent.firstName} {selectedStudent.lastName} • Class {selectedStudent.section} • Roll: {selectedStudent.rollNumber}
                </p>
                <p className="text-sm text-yellow-800 mt-1">
                  <strong>Risk Level:</strong> <span className="font-semibold">{selectedStudent.riskLevel}</span> ({selectedStudent.riskScore}%)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={messageData.type}
                  onChange={(e) => setMessageData({ ...messageData, type: e.target.value })}
                  className="input"
                >
                  <option value="Urgent">Urgent</option>
                  <option value="Academic">Academic Concern</option>
                  <option value="Behavioral">Behavioral Concern</option>
                  <option value="Attendance">Attendance Issue</option>
                  <option value="Meeting Request">Meeting Request</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={messageData.priority}
                  onChange={(e) => setMessageData({ ...messageData, priority: e.target.value })}
                  className="input"
                >
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Normal">Normal</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={messageData.subject}
                  onChange={(e) => setMessageData({ ...messageData, subject: e.target.value })}
                  className="input"
                  placeholder="e.g., Urgent: Student at High Risk of Dropout"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={messageData.message}
                  onChange={(e) => setMessageData({ ...messageData, message: e.target.value })}
                  className="input"
                  rows={6}
                  placeholder="Write your message to the parent here..."
                  maxLength={2000}
                />
                <p className="text-xs text-gray-500 mt-1">{messageData.message.length}/2000 characters</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This message will be sent to the parent via the parent portal and they will receive a real-time notification.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSendMessageModal(false)
                  setMessageData({ subject: '', message: '', type: 'Urgent', priority: 'High' })
                }}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!messageData.subject || !messageData.message) {
                    toast.error('Please fill in all required fields')
                    return
                  }

                  try {
                    const communicationData = {
                      studentId: selectedStudent.id,
                      recipient: 'parent',
                      subject: messageData.subject,
                      message: messageData.message,
                      type: messageData.type,
                      priority: messageData.priority,
                      method: 'App',
                      tags: ['At-Risk Student', 'Teacher Alert']
                    }

                    const response = await teacherAPI.sendCommunication(communicationData)
                    
                    if (response.data.success) {
                      toast.success(`Message sent to parent of ${selectedStudent.firstName} ${selectedStudent.lastName}`)
                      
                      // Send real-time notification via socket
                      if (socket && response.data.data?.parentId) {
                        socket.emit('notification:send', {
                          userId: response.data.data.parentId,
                          type: 'communication',
                          title: 'New Message from Teacher',
                          message: `Regarding ${selectedStudent.firstName} ${selectedStudent.lastName}: ${messageData.subject}`,
                          priority: messageData.priority,
                          data: {
                            communicationId: response.data.data.communication._id,
                            studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`
                          }
                        })
                      }
                      
                      setShowSendMessageModal(false)
                      setMessageData({ subject: '', message: '', type: 'Urgent', priority: 'High' })
                    } else {
                      toast.error('Failed to send message')
                    }
                  } catch (error) {
                    toast.error(error.response?.data?.message || 'Failed to send message')
                    console.error('Message send error:', error)
                  }
                }}
                className="btn-primary flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AtRiskStudents