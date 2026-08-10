#include <string>
namespace facebook { namespace react {
class BaseViewProps { public: std::string getDebugProps() const; };
std::string BaseViewProps::getDebugProps() const { return ""; }
}}
