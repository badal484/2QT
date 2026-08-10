require 'xcodeproj'
project_path = 'ios/VeltoMobile.xcodeproj'
project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == 'VeltoMobile' }
group = project.main_group.find_subpath(File.join('VeltoMobile'), true)
file_ref = group.new_reference('ReactCppFix.mm')
target.add_file_references([file_ref])
project.save
