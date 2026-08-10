#include <string>
#include <vector>
#include <memory>

namespace facebook {
namespace react {

struct DebugStringConvertibleOptions {
  bool format{true};
};

class DebugStringConvertible {
public:
    std::string getDebugName() const;
    std::string getDebugValue() const;
    std::vector<std::shared_ptr<DebugStringConvertible>> getDebugChildren() const;
    std::string getDebugDescription(DebugStringConvertibleOptions) const;
    std::string getDebugPropsDescription(DebugStringConvertibleOptions) const;
    std::string getDebugChildrenDescription(DebugStringConvertibleOptions) const;
};

std::string DebugStringConvertible::getDebugName() const { return ""; }
std::string DebugStringConvertible::getDebugValue() const { return ""; }
std::vector<std::shared_ptr<DebugStringConvertible>> DebugStringConvertible::getDebugChildren() const { return {}; }
std::string DebugStringConvertible::getDebugDescription(DebugStringConvertibleOptions) const { return ""; }
std::string DebugStringConvertible::getDebugPropsDescription(DebugStringConvertibleOptions) const { return ""; }
std::string DebugStringConvertible::getDebugChildrenDescription(DebugStringConvertibleOptions) const { return ""; }

class Sealable {
public:
    void ensureUnsealed() const;
};
void Sealable::ensureUnsealed() const {}

class ShadowNode {
public:
    std::string getDebugName() const;
    std::string getDebugValue() const;
    std::vector<std::shared_ptr<DebugStringConvertible>> getDebugChildren() const;
};

std::string ShadowNode::getDebugName() const { return ""; }
std::string ShadowNode::getDebugValue() const { return ""; }
std::vector<std::shared_ptr<DebugStringConvertible>> ShadowNode::getDebugChildren() const { return {}; }

class BaseViewProps {
public:
    std::string getDebugProps() const;
};
std::string BaseViewProps::getDebugProps() const { return ""; }

class YogaStylableProps {
public:
    std::string getDebugProps() const;
};
std::string YogaStylableProps::getDebugProps() const { return ""; }

class LayoutableShadowNode {
public:
    std::string getDebugProps() const;
};
std::string LayoutableShadowNode::getDebugProps() const { return ""; }

class Props {
public:
    std::string getDebugProps() const;
};
std::string Props::getDebugProps() const { return ""; }

}
}
