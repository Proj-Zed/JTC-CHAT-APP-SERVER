const User = require("../models/user");
const filterObj = require("../utils/filterObject");

exports.updateMe = async (req, res, next) => {
  const { user } = req;

  const filteredBody = filterObj(
    req.body,
    "firstName",
    "lastName",
    "about",
    "avatar"
  );

  const updated_user = await User.findByIdAndUpdate(user._id, filteredBody, {
    new: true,
    validateModifyOnly: true,
  });

  res.status(200).json({
    status: "success",
    data: updated_user,
    message: "User Updated Successfully!",
  });
};
